import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: (origin: any, cb: any) => cb(null, true),
    credentials: true,
  },
})
export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected to OrderGateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected from OrderGateway: ${client.id}`);
  }

  @SubscribeMessage('order:seller:updates')
  handleSellerUpdates(client: Socket, payload: any) {
    const sellerId = payload?.sellerId;
    if (sellerId) {
      client.join(`seller:${sellerId}:orders`);
    }
    return { event: 'order:seller:updates', data: { subscribed: true, sellerId: sellerId || null } };
  }

  sendOrderUpdate(payload: any) {
    this.server.emit('order:seller:updates', payload);
    const sellerId = payload.sellerId || payload.order?.seller?.userId;
    if (sellerId) {
      this.server.to(`seller:${sellerId}:orders`).emit(`order:seller:${sellerId}:updates`, payload);
    }

    const orderId = payload.orderId || (payload.order ? payload.order._id : null);
    if (orderId) {
      this.server.emit(`order:${orderId}:status`, payload);
    }
    
    if (payload.orderNumber) {
      this.server.emit(`order:${payload.orderNumber}:status`, payload);
    }
  }
}
