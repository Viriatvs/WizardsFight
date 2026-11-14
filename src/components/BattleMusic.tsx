'use client';

import { useEffect, useRef, useState } from 'react';
import PixelIcon from '@/components/PixelIcon';

const MUSIC_SRC = '/music/mage_duel_16bit_DARK_BATTLE_loop.ogg';
// Browser volume scales the signal, not loudness: 0.5 only sounds slightly quieter. ~0.3 sounds about half as loud.
const VOLUME = 0.3;
/** Remembers the on/off choice on this computer. */
const STORAGE_KEY = 'wf-music';

function savedChoice(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/**
 * Looping battle music for the main screen, with an on/off toggle in the corner.
 * Browsers block sound until the page gets a click or key press, so if autoplay is refused
 * the music starts on the first interaction (while it's on).
 */
export default function BattleMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [on, setOn] = useState(true);

  // Read after the first render: the server has no localStorage, and the first render must match its HTML.
  useEffect(() => setOn(savedChoice()), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = VOLUME;
    if (!on) {
      audio.pause();
      return;
    }
    const start = () => audio.play().catch(() => {});
    audio.play().catch(() => {
      // Autoplay refused: wait for the first interaction with the page.
      window.addEventListener('pointerdown', start, { once: true });
      window.addEventListener('keydown', start, { once: true });
    });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, [on]);

  const toggle = () => {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    } catch {
      // Private window or blocked storage: the choice just isn't remembered.
    }
  };

  return (
    <>
      <audio ref={audioRef} src={MUSIC_SRC} loop preload="auto" />
      <button
        onClick={toggle}
        aria-pressed={on}
        aria-label={on ? 'Turn music off' : 'Turn music on'}
        title={on ? 'Music on' : 'Music off'}
        className="fixed top-4 right-4 z-[60] flex h-12 w-12 items-center justify-center border-4 border-gray-600 bg-stone-dark/90 text-3xl hover:border-amber-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400"
      >
        <PixelIcon name={on ? 'soundOn' : 'soundOff'} />
      </button>
    </>
  );
}
