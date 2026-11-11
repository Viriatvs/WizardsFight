'use client';

import { useState, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export default function LandingPage() {
  const [loading, setLoading] = useState(false);
  // Set when a battle/play page redirected here because its room no longer exists.
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setExpired(new URLSearchParams(window.location.search).has('expired'));
  }, []);

  const startFight = useCallback(() => {
    setLoading(true);
    const socket: Socket = io({ path: '/socket.io' });

    socket.on('connect', () => {
      socket.emit('room:create', (result: { roomId: string }) => {
        socket.disconnect();
        window.location.href = `/battle/${result.roomId}`;
      });
    });

    socket.on('connect_error', () => {
      setLoading(false);
    });
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center justify-center hero-section px-4 py-8 min-h-screen">
      <div className="text-center max-w-2xl mx-auto w-full">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-4xl sm:text-5xl">🧙‍♂️</span>
            <span className="text-2xl sm:text-3xl text-red-500 animate-pulse">⚔️</span>
            <span className="text-4xl sm:text-5xl">🧙‍♀️</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black uppercase tracking-tight text-center leading-tight">
            <span className="text-blue-400">Wizards</span>
            <span className="text-gray-500 mx-1 sm:mx-2">vs</span>
            <span className="text-red-400">Wizards</span>
          </h1>

          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mt-1 text-amber-400 text-center">
            FIGHT
          </h2>
        </div>

        <p className="text-gray-400 text-sm sm:text-lg mb-2 max-w-md mx-auto leading-relaxed px-2">
          Challenge an opponent to a <strong className="text-gray-200">real-time spell-casting duel</strong>.
          One spell. Two wizards. Fastest correct incantation wins.
        </p>

        <div className="text-gray-500 text-xs sm:text-sm mb-8 space-y-1">
          <p>📱 Both players use their phones to cast</p>
          <p>🖥️ One screen hosts the battle</p>
          <p>🌍 Spells in <em className="text-amber-300">Latin</em></p>
        </div>

        {expired && (
          <p role="status" className="mb-6 mx-auto max-w-sm px-4 py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm">
            That battle has ended or no longer exists. Start a new fight below.
          </p>
        )}

        <button
          onClick={startFight}
          disabled={loading}
          className="btn-fight w-full max-w-xs sm:px-12 py-4 text-xl sm:text-2xl font-black uppercase tracking-wider text-white rounded-2xl shadow-2xl shadow-red-900/30 disabled:opacity-50 disabled:cursor-wait"
        >
          {loading ? 'Creating Battle…' : '⚔️ Start Fight'}
        </button>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-8 text-gray-600 text-xs sm:text-sm px-4">
          <span>2 Players Max</span>
          <span className="hidden sm:inline">•</span>
          <span>Real-time WebSocket</span>
          <span className="hidden sm:inline">•</span>
          <span>Server-timed Scoring</span>
        </div>

        <footer className="mt-12 pb-6 text-center">
          <p className="text-gray-500 text-xs sm:text-sm leading-relaxed">
            Created by the portuguese hero <span className="font-semibold text-gray-400">MOSORIO</span> based on the idea of the mighty warrior <span className="font-semibold text-gray-400">HREYNOLDS</span>
          </p>
        </footer>
      </div>
    </main>
  );
}
