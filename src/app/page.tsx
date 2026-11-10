'use client';

import { useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export default function LandingPage() {
  const [loading, setLoading] = useState(false);

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
    <main className="flex-1 flex flex-col items-center justify-center hero-section px-4">
      <div className="text-center max-w-2xl mx-auto">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <span className="text-5xl">🧙‍♂️</span>
            <span className="text-3xl text-red-500 animate-pulse">⚔️</span>
            <span className="text-5xl">🧙‍♀️</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tight text-center leading-tight">
            <span className="text-blue-400">Wizards</span>
            <span className="text-gray-500 mx-2">vs</span>
            <span className="text-red-400">Wizards</span>
          </h1>

          <h2 className="text-3xl md:text-4xl font-bold mt-1 text-amber-400 text-center">
            FIGHT
          </h2>
        </div>

        <p className="text-gray-400 text-lg mb-2 max-w-md mx-auto leading-relaxed">
          Challenge an opponent to a <strong className="text-gray-200">real-time spell-casting duel</strong>.
          One spell. Two wizards. Fastest correct incantation wins.
        </p>

        <div className="text-gray-500 text-sm mb-10 space-y-1">
          <p>📱 Both players use their phones to cast</p>
          <p>🖥️ One screen hosts the battle</p>
          <p>🌍 Spells in <em className="text-amber-300">Latin</em></p>
        </div>

        <button
          onClick={startFight}
          disabled={loading}
          className="btn-fight px-12 py-4 text-2xl font-black uppercase tracking-wider text-white rounded-2xl shadow-2xl shadow-red-900/30 disabled:opacity-50 disabled:cursor-wait"
        >
          {loading ? 'Creating Battle…' : '⚔️ Start Fight'}
        </button>

        <div className="mt-10 flex items-center justify-center gap-8 text-gray-600 text-sm">
          <span>2 Players Max</span>
          <span>•</span>
          <span>Real-time WebSocket</span>
          <span>•</span>
          <span>Server-timed Scoring</span>
        </div>
      </div>
    </main>
  );
}
