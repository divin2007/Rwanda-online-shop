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
    const userId = client.handshake.query.userId as string;
    const token = client.handshake.auth?.token as string;

    // 2D fix: validate auth token when provided
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jwt.verify(token, secret) as any;
        // If token userId doesn't match query userId, use the token one (trusted)
        const trustedUserId = decoded.userId || decoded.sub || userId;
        if (trustedUserId && trustedUserId !== userId) {
          this.logger.warn(`Socket auth mismatch: query=${userId}, token=${trustedUserId}. Using token.`);
        }
        const resolvedUserId = trustedUserId || userId;
        if (resolvedUserId) {
          const sockets = this.userSockets.get(resolvedUserId) || [];
          sockets.push(client.id);
          this.userSockets.set(resolvedUserId, sockets);
          this.logger.log(`Client connected: ${client.id} (User: ${resolvedUserId}, authenticated)`);
        }
      } catch (err: any) {
        this.logger.warn(`Socket auth failed for client ${client.id}: ${err.message}`);
        // In production, reject unauthenticated connections
        if (process.env.NODE_ENV === 'production') {
          client.disconnect(true);
          return;
        }
        // In dev, allow connection with userId from query
        if (userId) {
          const sockets = this.userSockets.get(userId) || [];
          sockets.push(client.id);
          this.userSockets.set(userId, sockets);
          this.logger.log(`Client connected: ${client.id} (User: ${userId}, dev mode - no auth)`);
        }
      }
    } else if (userId) {
      // No token provided — allow in dev, log warning
      const sockets = this.userSockets.get(userId) || [];
      sockets.push(client.id);
      this.userSockets.set(userId, sockets);
      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
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
