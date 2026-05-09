'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

export function useSocket<T = any>(url: string, channel: string, token?: string) {
  const [data, setData] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Create socket once per URL — polling first so it ALWAYS connects
  // regardless of WebSocket CORS issues in the browser
  useEffect(() => {
    if (!url) return;

    const socket = io(url, {
      transports: ['polling', 'websocket'], // polling first = always works, upgrades silently
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 20000,
      ...(token ? { auth: { token } } : {}),
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', (err) => {
      console.warn('[useSocket] connect_error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]); // Only re-create socket if the service URL changes

  // Attach / detach the channel listener separately from socket creation
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !channel) return;

    const handler = (payload: T) => setData(payload);
    socket.on(channel, handler);

    return () => {
      socket.off(channel, handler);
    };
  }, [channel]); // Re-bind listener if channel name changes

  const emit = useCallback((event: string, payload: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, payload);
    } else {
      console.warn('[useSocket] Cannot emit — socket not connected');
    }
  }, []);

  return { data, isConnected, emit };
}
