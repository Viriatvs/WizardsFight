'use client';

import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface SocketCallbacks {
  onRoomUpdate?: (data: unknown) => void;
  onCountdown?: (data: { seconds: number }) => void;
  onSpellReveal?: (data: { spell: string; revealedAt: number }) => void;
  onSpellSubmitted?: (data: { correct: boolean; durationMs: number; expected: string; submitted: string }) => void;
  onBattleEnd?: (data: {
    winnerColor: string | null;
    winnerName: string | null;
    durationMs: number | null;
    results: Record<string, { color: string; name: string; durationMs: number; correct: boolean }>;
    timedOut?: boolean;
  }) => void;
  onPlayerDisconnected?: (data: { color: string; name: string }) => void;
  onError?: (data: { message: string }) => void;
}

export function useSocket(
  roomId: string | undefined,
  callbacks: SocketCallbacks,
  role: 'host' | 'player' = 'player',
) {
  const socketRef = useRef<Socket | null>(null);
  const emitRef = useRef<(event: string, payload?: unknown, cb?: (res: unknown) => void) => void>(() => {});

  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    emitRef.current = (event, payload, cb) => {
      socketRef.current?.emit(event, payload, cb);
    };

    socket.on('connect', () => {
      if (roomId) {
        if (role === 'host') {
          socket.emit('room:watch', { roomId }, (res: { success: boolean; data?: unknown; error?: string }) => {
            if (res.success && res.data && callbacks.onRoomUpdate) {
              callbacks.onRoomUpdate(res.data);
            }
          });
        } else {
          socket.emit('room:join', { roomId }, (res: { success: boolean; color?: string; error?: string }) => {
            if (res.success && callbacks.onRoomUpdate) {
              callbacks.onRoomUpdate(res);
            }
          });
        }
      }
    });

    socket.on('room:update', (data) => callbacks.onRoomUpdate?.(data));
    socket.on('countdown', (data) => callbacks.onCountdown?.(data));
    socket.on('spell:reveal', (data) => callbacks.onSpellReveal?.(data));
    socket.on('spell:submitted', (data) => callbacks.onSpellSubmitted?.(data));
    socket.on('battle:end', (data) => callbacks.onBattleEnd?.(data));
    socket.on('player:disconnected', (data) => callbacks.onPlayerDisconnected?.(data));
    socket.on('error', (data) => callbacks.onError?.(data));

    return () => { socket.disconnect(); };
  }, [roomId, role, callbacks]);

  const emit = useCallback((event: string, payload?: unknown, cb?: (res: unknown) => void) => {
    emitRef.current(event, payload, cb);
  }, []);

  return { emit, socketRef };
}
