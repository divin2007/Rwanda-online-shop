import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * Live Selling gateway (Feature 2). Handles viewer rooms, comments, reactions, viewer counts,
 * and product/order events. streamKey is NEVER transmitted over the socket.
 */
@WebSocketGateway({
  cors: {
    origin: (origin: any, cb: any) => cb(null, true),
    credentials: true,
  },
})
export class LiveGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LiveGateway.name);
  private viewerCounts = new Map<string, number>();

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const secret = process.env.JWT_SECRET || 'change-me-to-a-strong-random-secret-at-least-32-chars';
        (client as any).user = jwt.verify(token, secret);
      } catch {
        /* anonymous viewers allowed */
      }
    }
  }

  @SubscribeMessage('live:join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() sessionId: string) {
    client.join(`live:${sessionId}`);
    const count = (this.viewerCounts.get(sessionId) || 0) + 1;
    this.viewerCounts.set(sessionId, count);
    (client as any).liveSessionId = sessionId;
    this.server.to(`live:${sessionId}`).emit('live:viewer_join', { sessionId, viewerCount: count });
    return { success: true, viewerCount: count };
  }

  @SubscribeMessage('live:leave')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() sessionId: string) {
    const count = Math.max(0, (this.viewerCounts.get(sessionId) || 1) - 1);
    this.viewerCounts.set(sessionId, count);
    client.leave(`live:${sessionId}`);
    this.server.to(`live:${sessionId}`).emit('live:viewer_leave', { sessionId, viewerCount: count });
    return { success: true, viewerCount: count };
  }

  @SubscribeMessage('live:comment')
  handleComment(@ConnectedSocket() client: Socket, @MessageBody() payload: { sessionId: string; text: string; name?: string }) {
    if (!payload?.sessionId || !payload?.text) return { success: false };
    this.server.to(`live:${payload.sessionId}`).emit('live:comment', {
      text: String(payload.text).slice(0, 500),
      name: payload.name || 'Viewer',
      at: new Date(),
    });
    return { success: true };
  }

  @SubscribeMessage('live:reaction')
  handleReaction(@ConnectedSocket() client: Socket, @MessageBody() payload: { sessionId: string; reaction: string }) {
    if (!payload?.sessionId) return { success: false };
    this.server.to(`live:${payload.sessionId}`).emit('live:reaction', { reaction: payload.reaction || '❤️', at: new Date() });
    return { success: true };
  }

  // Server-side emit helpers.
  emitToRoom(sessionId: string, event: string, payload: any) {
    this.server?.to(`live:${sessionId}`).emit(event, payload);
  }

  emitToMarket(marketId: string, event: string, payload: any) {
    this.server?.to(`market:${marketId}`).emit(event, payload);
    // Also broadcast globally so the "Live Now" home section can react without joining a market room.
    this.server?.emit(event, payload);
  }

  emitNewOrder(sessionId: string, order: any) {
    this.server?.to(`live:${sessionId}`).emit('live:new_order', order);
  }
}
