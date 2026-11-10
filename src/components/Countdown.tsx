'use client';

export default function Countdown({ seconds }: { seconds: number | null }) {
  if (seconds === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
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
