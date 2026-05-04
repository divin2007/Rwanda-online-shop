import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DeliveryService } from './delivery.service';
import { forwardRef, Inject } from '@nestjs/common';
import * as crypto from 'crypto';

@WebSocketGateway({
  cors: { origin: '*' }
})
export class DeliveryGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // In-memory active riders: memory-only, instant removal
  private activeRiders = new Map<string, any>();

  constructor(
    @Inject(forwardRef(() => DeliveryService))
    private deliveryService: DeliveryService
  ) {}

  handleConnection(client: Socket) {
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
    // 10s updates, memory-only
    this.activeRiders.set(payload.riderId, {
      socketId: client.id,
      lat: payload.lat,
      lng: payload.lng,
      marketId: payload.marketId,
      updatedAt: Date.now()
    });

    // Hash riderId for anonymity
    const anonymousHash = crypto.createHash('md5').update(payload.riderId).digest('hex').substring(0, 8);

    // Broadcast to public map
    this.server.emit('rider:public:locations', {
      riderId: anonymousHash, // ANONYMIZED
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
    @MessageBody() payload: { deliveryId: string, senderId: string, senderName: string, message: string }
  ) {
    const chatMsg = {
      ...payload,
      timestamp: new Date()
    };

    // Emit to everyone in the delivery room
    this.server.to(`delivery:${payload.deliveryId}`).emit(`delivery:${payload.deliveryId}:chat`, chatMsg);
    
    // Also emit a general notification for the rider if they are not in the room
    this.server.emit(`user:${payload.deliveryId}:notification`, {
      type: 'NEW_CHAT_MESSAGE',
      ...chatMsg
    });

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

  // Broadcast to all active riders (radius check removed per user request)
  broadcastToNearbyRiders(deliveryReq: any, marketLat: number, marketLng: number) {
    let notifiedCount = 0;
    for (const [riderId, data] of this.activeRiders.entries()) {
      // Radius check removed: notifying all active riders
      this.server.to(data.socketId).emit('delivery:request', {
        ...deliveryReq,
        // Optional: still include distance info if you want to show it to the rider
        distanceFromMarket: `${Math.round(this.getDistanceMeters(marketLat, marketLng, data.lat, data.lng))}m`
      });
      notifiedCount++;
    }
    console.log(`Broadcasted delivery request to ${notifiedCount} active riders.`);
    return notifiedCount;
  }
}
