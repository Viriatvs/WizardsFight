'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import FightTicker from '@/components/FightTicker';

/** Looks like plain art (no pointer), but is a real link so keyboards can reach it too. */
const EASTER_EGG = 'text-4xl sm:text-5xl cursor-default focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400';

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
            {/* Easter egg: the wizards open the hidden Fight History page. */}
            <Link href="/history" aria-label="Fight history" className={EASTER_EGG}>🧙‍♂️</Link>
            <span className="text-2xl sm:text-3xl text-red-500 animate-pulse" aria-hidden="true">⚔️</span>
            <Link href="/history" aria-label="Fight history" className={EASTER_EGG}>🧙‍♀️</Link>
          </div>

          <h1
            className="flex flex-wrap justify-center gap-x-3 text-4xl sm:text-6xl md:text-7xl font-black uppercase text-center leading-tight"
            style={{ textShadow: '4px 4px 0 #000' }}
          >
            <span className="text-blue-400">Wizards</span>
            <span className="text-gray-500 mx-1 sm:mx-2">vs</span>
            <span className="text-red-400">Wizards</span>
          </h1>

          <h2 className="text-2xl sm:text-4xl md:text-5xl mt-1 text-amber-400 text-center" style={{ textShadow: '3px 3px 0 #000' }}>
            FIGHT
          </h2>
        </div>

        <div className="panel-stone px-5 py-5 mb-10 mx-auto max-w-md">
          <p className="text-gray-200 text-base sm:text-lg leading-relaxed">
            Challenge an opponent to a <strong className="text-amber-300">real-time spell-casting duel</strong>.
            One spell. Two wizards. Fastest correct incantation wins.
          </p>
          <div className="text-gray-400 text-sm mt-3 space-y-1">
            <p>📱 Both players use their phones to cast</p>
            <p>🖥️ One screen hosts the battle</p>
            <p>🌍 Spells in <em className="text-amber-300">Latin</em></p>
          </div>
        </div>

        {expired && (
          <p role="status" className="panel-stone mb-8 mx-auto max-w-sm px-4 py-3 text-amber-200 text-sm">
            That battle has ended or no longer exists. Start a new fight below.
          </p>
        )}

        <button
          onClick={startFight}
          disabled={loading}
          className="btn-pixel w-full max-w-xs py-4 text-xl sm:text-2xl disabled:cursor-wait"
        >
          {loading ? 'Creating battle…' : '⚔️ Start Fight'}
        </button>

        <FightTicker />

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-8 text-gray-500 text-xs sm:text-sm px-4 font-pixel uppercase tracking-wider">
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
