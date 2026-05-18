import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { NotificationService } from './notification.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/',
})
export class NotificationGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('NotificationGateway');
  private userSockets: Map<string, string[]> = new Map();

  constructor(private readonly notificationService: NotificationService) {
    this.notificationService.setGateway(this);
  }

  afterInit(server: Server) {
    this.logger.log('Notification Gateway Initialized');
  }

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string;
    if (!token) {
      this.logger.warn(`Rejected unauthenticated connection: ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = jwt.verify(token, secret) as any;
      const resolvedUserId = decoded.userId || decoded.sub;

      if (!resolvedUserId) {
        throw new Error('No userId in token');
      }

      client.data.userId = resolvedUserId;
      const sockets = this.userSockets.get(resolvedUserId) || [];
      sockets.push(client.id);
      this.userSockets.set(resolvedUserId, sockets);
      this.logger.log(`Client connected: ${client.id} (User: ${resolvedUserId})`);
    } catch (err: any) {
      this.logger.warn(`Socket auth failed for client ${client.id}: ${err.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId) || [];
      const index = sockets.indexOf(client.id);
      if (index > -1) {
        sockets.splice(index, 1);
        if (sockets.length === 0) {
          this.userSockets.delete(userId);
        } else {
          this.userSockets.set(userId, sockets);
        }
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitToUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }
}
