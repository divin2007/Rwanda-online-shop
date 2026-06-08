import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DeliveryService } from './delivery.service';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

const DEFAULT_SOCKET_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000,https://rwshop.org,https://www.rwshop.org';

function getAllowedSocketOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || DEFAULT_SOCKET_ORIGINS)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function parseOrigin(origin: string): URL | null {
  try {
    return new URL(origin);
  } catch {
    return null;
  }
}

function matchesAllowedOrigin(origin: string): boolean {
  const allowedOrigins = getAllowedSocketOrigins();
  if (allowedOrigins.includes('*')) return true;
  if (allowedOrigins.includes(origin)) return true;

  const parsedOrigin = parseOrigin(origin);
  if (!parsedOrigin) return false;

  return allowedOrigins.some((allowedOrigin) => {
    const parsedAllowed = parseOrigin(allowedOrigin);
    if (!parsedAllowed || parsedAllowed.protocol !== parsedOrigin.protocol) return false;
    if (parsedAllowed.port && parsedAllowed.port !== parsedOrigin.port) return false;

    const allowedHost = parsedAllowed.hostname.toLowerCase();
    const originHost = parsedOrigin.hostname.toLowerCase();

    if (allowedHost === originHost) return true;

    const allowsLocalhostTenant =
      (allowedHost === 'localhost' || allowedHost === '127.0.0.1') &&
      (originHost === 'localhost' || originHost.endsWith('.localhost'));

    const allowsRwshopTenant =
      (allowedHost === 'rwshop.org' || allowedHost.endsWith('.rwshop.org')) &&
      (originHost === 'rwshop.org' || originHost.endsWith('.rwshop.org'));

    return allowsLocalhostTenant || allowsRwshopTenant;
  });
}

@WebSocketGateway({
  cors: {
    origin: (origin: any, cb: any) => {
      if (!origin || matchesAllowedOrigin(origin)) {
        return cb(null, true);
      }
      return cb(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
  },
})
export class DeliveryGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DeliveryGateway.name);
  // In-memory active riders: memory-only, instant removal
  private activeRiders = new Map<string, any>();

  constructor(
    @Inject(forwardRef(() => DeliveryService))
    private deliveryService: DeliveryService
  ) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const secret = process.env.JWT_SECRET || 'change-me-to-a-strong-random-secret-at-least-32-chars';
        const decoded = jwt.verify(token, secret);
        (client as any).user = decoded;
      } catch (err) {
        console.log(`Socket auth failed: ${err}`);
      }
    }
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    
    // Remove rider from map if they disconnect
    for (const [riderId, data] of this.activeRiders.entries()) {
      if (data.socketId === client.id) {
        this.activeRiders.delete(riderId);
        break;
      }
    }
  }

  @SubscribeMessage('rider:location:update')
  handleRiderLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { riderId: string, lat: number, lng: number, marketId?: string }
  ) {
    const user = (client as any).user;
    if (!user || (user.userId !== payload.riderId && user.sub !== payload.riderId && user.role !== 'ADMIN')) {
      return { success: false, error: 'Unauthorized' };
    }

    // 10s updates, memory-only
    this.activeRiders.set(payload.riderId, {
      socketId: client.id,
      lat: payload.lat,
      lng: payload.lng,
      marketId: payload.marketId,
      updatedAt: Date.now()
    });

    // Broadcast to public map - sending real ID for admin oversight and profile lookup
    this.server.emit('rider:public:locations', {
      riderId: payload.riderId, 
      lat: payload.lat,
      lng: payload.lng,
      marketId: payload.marketId
    });
  }

  @SubscribeMessage('delivery:tracking:update')
  async handleDeliveryTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { deliveryId: string, lat: number, lng: number }
  ) {
    const user = (client as any).user;
    if (!user || (user.role !== 'RIDER' && user.role !== 'ADMIN')) {
      return { success: false, error: 'Unauthorized' };
    }

    // Save to DB for actual active delivery
    await this.deliveryService.streamLocation(payload.deliveryId, { lat: payload.lat, lng: payload.lng });

    // Emit on private channel
    this.server.to(`delivery:${payload.deliveryId}`).emit(`delivery:${payload.deliveryId}:tracking`, {
      lat: payload.lat,
      lng: payload.lng,
      recordedAt: new Date()
    });
  }

  @SubscribeMessage('join:delivery')
  handleJoinDeliveryRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() deliveryId: string
  ) {
    client.join(`delivery:${deliveryId}`);
    return { success: true, room: `delivery:${deliveryId}` };
  }

  @SubscribeMessage('chat:message')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { deliveryId: string, senderId: string, senderName: string, text: string }
  ) {
    const user = (client as any).user;
    if (!user || (user.userId !== payload.senderId && user.sub !== payload.senderId && user.role !== 'ADMIN')) {
      return { success: false, error: 'Unauthorized' };
    }

    const chatMsg = {
      ...payload,
      timestamp: new Date()
    };

    // Emit ONLY to clients who joined this delivery's room — not to everyone
    this.server.to(`delivery:${payload.deliveryId}`).emit(`delivery:${payload.deliveryId}:chat`, chatMsg);

    return { success: true };
  }
  
  // Method to be called from service/controller
  emitAssignment(delivery: any) {
    this.server.emit('delivery:assigned', delivery);
  }

  // Calculate distance between two coordinates in meters
  private getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  broadcastToActiveRiders(
    deliveryReq: any,
    marketLat: number,
    marketLng: number,
    options: {
      searchSurcharge?: number;
      deliveryFee?: number;
      radiusMeters?: number | null;
      nextRadiusMeters?: number | null;
      maxRadiusMeters?: number | null;
      strategy?: string;
    } = {}
  ): { notifiedCount: number; riderIds: string[]; candidateCount: number } {
    const maxLocationAgeMs = Number(process.env.RIDER_LOCATION_MAX_AGE_MS || 120000);
    let notifiedCount = 0;
    let candidateCount = 0;
    const riderIds: string[] = [];
    const radiusMeters = Number.isFinite(Number(options.radiusMeters)) ? Number(options.radiusMeters) : null;
    const strategy = options.strategy || (radiusMeters ? 'PROGRESSIVE_RADIUS' : 'GLOBAL_ACTIVE_RIDERS');
    this.logger.log(`Starting rider broadcast for delivery ${deliveryReq.orderNumber}. Strategy: ${strategy}. Radius: ${radiusMeters || 'global'}m. Active riders: ${this.activeRiders.size}`);
    
    for (const [riderId, data] of this.activeRiders.entries()) {
      try {
        if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng)) continue;
        if (Date.now() - Number(data.updatedAt || 0) > maxLocationAgeMs) continue;
        const distanceMeters = this.getDistanceMeters(marketLat, marketLng, data.lat, data.lng);
        if (radiusMeters !== null && distanceMeters > radiusMeters) continue;
        candidateCount++;
        this.server.to(data.socketId).emit('delivery:assigned', {
          ...deliveryReq,
          dispatch: {
            ...(deliveryReq.dispatch || {}),
            broadcastMode: strategy,
            radiusMeters,
            nextRadiusMeters: options.nextRadiusMeters ?? null,
            maxRadiusMeters: options.maxRadiusMeters ?? null,
            searchSurcharge: options.searchSurcharge || 0,
            deliveryFee: options.deliveryFee,
          },
          financials: {
            ...(deliveryReq.financials || {}),
            deliveryFee: options.deliveryFee ?? deliveryReq.financials?.deliveryFee,
            searchSurcharge: options.searchSurcharge || 0,
          },
          distanceMeters: Math.round(distanceMeters),
          distanceFromMarket: `${Math.round(distanceMeters)}m`
        });
        notifiedCount++;
        riderIds.push(riderId);
      } catch (err) {
        this.logger.error(`Failed to emit to rider ${riderId} on socket ${data.socketId}`, err);
      }
    }
    this.logger.log(`Broadcasted delivery request to ${notifiedCount} rider(s).`);
    return { notifiedCount, riderIds, candidateCount };
  }
}
