'use client';
import { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

export function useSocket<T = any>(url: string, channel: string, token?: string) {
  const [data, setData] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Prevent creating multiple sockets if not needed, or just handle cleanup
    const socketOptions: any = {
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'], // Fallback for stability on Render
      timeout: 20000,
    };

    if (token) {
      socketOptions.auth = { token };
    }

    const socket = io(url, socketOptions);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // Join the channel if the backend requires explicit joining via event
      // socket.emit('joinChannel', channel); 
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on(channel, (payload: T) => {
      setData(payload);
    });

    return () => {
      socket.off(channel);
      socket.disconnect();
    };
  }, [url, channel, token]);

  const emit = (event: string, payload: any) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, payload);
    }
  };

  return { data, isConnected, emit };
}
