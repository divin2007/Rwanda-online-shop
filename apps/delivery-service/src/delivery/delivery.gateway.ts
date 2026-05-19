import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DeliveryService } from './delivery.service';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@WebSocketGateway({
  cors: {
    origin: (origin: any, cb: any) => {
      const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001')
        .split(',')
        .map(o => o.trim());
      // Allow if no origin (server-to-server) or if explicitly listed
      if (!origin || allowed.some(o => o === '*' || origin.startsWith(o))) {
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

  // Broadcast only to currently connected riders inside the adaptive pickup radius.
  broadcastToNearbyRiders(
    deliveryReq: any,
    marketLat: number,
    marketLng: number,
    options: { radiusMeters?: number; searchSurcharge?: number; deliveryFee?: number } = {}
  ): { notifiedCount: number; riderIds: string[] } {
    const radiusMeters = Math.max(50, Number(options.radiusMeters || 150));
    const maxLocationAgeMs = Number(process.env.RIDER_LOCATION_MAX_AGE_MS || 120000);
    let notifiedCount = 0;
    const riderIds: string[] = [];
    this.logger.log(`Starting ${radiusMeters}m broadcast for delivery ${deliveryReq.orderNumber}. Active riders: ${this.activeRiders.size}`);
    
    for (const [riderId, data] of this.activeRiders.entries()) {
      try {
        if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng)) continue;
        if (Date.now() - Number(data.updatedAt || 0) > maxLocationAgeMs) continue;
        const distanceMeters = this.getDistanceMeters(marketLat, marketLng, data.lat, data.lng);
        if (distanceMeters > radiusMeters) continue;
        this.server.to(data.socketId).emit('delivery:assigned', {
          ...deliveryReq,
          dispatch: {
            ...(deliveryReq.dispatch || {}),
            radiusMeters,
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
    this.logger.log(`Broadcasted delivery request to ${notifiedCount} rider(s) inside ${radiusMeters}m.`);
    return { notifiedCount, riderIds };
  }
}
