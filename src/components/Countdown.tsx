'use client';

export default function Countdown({ seconds, label }: { seconds: number | null; label?: string }) {
  if (seconds === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      {label && (
        <div className="text-2xl md:text-4xl font-black uppercase tracking-widest text-amber-400 mb-4 text-center px-4">
          {label}
        </div>
      )}
      <div
        key={seconds}
        className="text-9xl font-black text-white animate-countdown select-none"
        style={{
          textShadow: '0 0 40px rgba(245,158,11,0.8), 0 0 80px rgba(245,158,11,0.4)',
        }}
      >
        {seconds}
      </div>
    </div>
  );
}
