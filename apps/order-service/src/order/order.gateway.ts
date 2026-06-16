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
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
          throw new Error('JWT_SECRET is not configured');
        }
        const secret = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
        const decoded = jwt.verify(token, secret);
        (client as any).user = decoded;
      } catch (err) {
        console.log(`Socket auth failed: ${err}`);
      }
    }
    console.log(`Client connected to OrderGateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected from OrderGateway: ${client.id}`);
  }

  @SubscribeMessage('order:seller:updates')
  handleSellerUpdates(client: Socket, payload: any) {
    const user = (client as any).user;
    const sellerId = payload?.sellerId;
    if (sellerId) {
      if (!user || (user.userId !== sellerId && user.sub !== sellerId && user.role !== 'ADMIN')) {
        return { event: 'order:seller:updates', data: { success: false, error: 'Unauthorized' } };
      }
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
