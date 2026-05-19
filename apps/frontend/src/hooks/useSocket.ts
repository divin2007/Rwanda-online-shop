'use client';
import { useEffect, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

export function useSocket<T = any>(url: string, channel: string, token?: string, options?: any) {
  const [data, setData] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Create socket once per URL — polling first so it ALWAYS connects
  // regardless of WebSocket CORS issues in the browser
  useEffect(() => {
    if (!url) return;
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') || undefined : undefined);

    const s = io(url, {
      transports: ['polling', 'websocket'], // polling first = always works, upgrades silently
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 20000,
      ...(authToken ? { auth: { token: authToken } } : {}),
      ...(options || {})
    });

    setSocket(s);

    s.on('connect', () => setIsConnected(true));
    s.on('disconnect', () => setIsConnected(false));
    s.on('connect_error', (err) => {
      console.warn('[useSocket] connect_error:', err.message);
    });

    return () => {
      s.disconnect();
      setSocket(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, token]); // Re-create socket if the service URL or explicit auth token changes

  // Attach / detach the channel listener separately from socket creation
  useEffect(() => {
    if (!socket || !channel) return;

    const handler = (payload: T) => setData(payload);
    socket.on(channel, handler);

    return () => {
      socket.off(channel, handler);
    };
  }, [socket, channel]); // Re-bind listener if channel or socket instance changes

  const emit = useCallback((event: string, payload: any) => {
    if (socket?.connected) {
      socket.emit(event, payload);
    } else {
      console.warn('[useSocket] Cannot emit — socket not connected');
    }
  }, [socket]);

  return { data, isConnected, emit };
}
