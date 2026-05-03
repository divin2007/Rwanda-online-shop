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
    origin: '*',
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
    // In a real app, we would join the client to a room based on their sellerId
    // For now, we'll just acknowledge the subscription
    return { event: 'order:seller:updates', data: 'Subscribed to updates' };
  }

  sendOrderUpdate(payload: any) {
    this.server.emit('order:seller:updates', payload);
  }
}
