import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { socketUrl } from '../lib/api';
import { tokenStore } from '../lib/tokenStore';

export function useOrderSocket(channel?: string, customUrl?: string, onConnect?: (socket: Socket) => void) {
  const [payload, setPayload] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!channel) return;
    let socket: Socket | null = null;
    let cancelled = false;

    tokenStore.getAccessToken().then(token => {
      if (cancelled) return;
      socket = io(customUrl || socketUrl(), {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        timeout: 20000,
        auth: token ? { token } : undefined,
      });

      socket.on('connect', () => {
        setConnected(true);
        if (onConnect && socket) {
          onConnect(socket);
        }
      });
      socket.on('disconnect', () => setConnected(false));
      socket.on(channel, setPayload);
    });

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [channel, customUrl]);

  return { payload, connected };
}

