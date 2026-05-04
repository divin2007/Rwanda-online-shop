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
  }
  
  // Method to be called from service/controller
  emitAssignment(delivery: any) {
    this.server.emit('delivery:assigned', delivery);
  }
}
