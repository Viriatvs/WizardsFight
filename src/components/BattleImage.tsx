'use client';

interface BattleImageProps {
  blueJoined: boolean;
  redJoined: boolean;
  countdown: number | null;
  battleStarted: boolean;
  firstJoinColor?: 'blue' | 'red' | null;
}

function getSceneImage(blueJoined: boolean, redJoined: boolean): string {
  if (blueJoined && redJoined) return '/images/wizards-waiting.png';
  if (blueJoined) return '/images/blue-wizard_ready.png';
  if (redJoined) return '/images/red-wizard_ready.png';
  return '/images/battlefield-waiting.png';
}

export default function BattleImage({ blueJoined, redJoined, countdown, battleStarted }: BattleImageProps) {
  const bothJoined = blueJoined && redJoined;
  const imageSrc = getSceneImage(blueJoined, redJoined);

  return (
    <div className="relative w-full max-w-[1200px] mx-auto overflow-hidden border-4 border-gray-950 shadow-[8px_8px_0_0_rgba(0,0,0,0.65)]">
      <img
        src={imageSrc}
        alt="Battlefield scene"
        className="w-full h-auto block"
      />

      {!blueJoined && !redJoined && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/60 backdrop-blur-sm px-8 py-4 rounded-2xl border border-amber-500/30">
            <span className="text-amber-400 text-xl font-bold uppercase tracking-wider animate-pulse">
              Waiting for Wizards…
            </span>
          </div>
        </div>
      )}

      {(blueJoined || redJoined) && !bothJoined && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <div className="bg-black/60 backdrop-blur-sm px-6 py-3 rounded-2xl border border-amber-500/30">
            <span className="text-amber-400 text-lg font-bold uppercase tracking-wider animate-pulse">
              Waiting for the other team…
            </span>
          </div>
        </div>
      )}

      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            key={countdown}
            className="text-[12rem] md:text-[16rem] font-black text-amber-300 animate-countdown select-none leading-none"
            style={{
              textShadow: '0 0 40px rgba(245,158,11,0.8), 0 0 80px rgba(245,158,11,0.4), 0 0 120px rgba(245,158,11,0.2)',
            }}
          >
            {countdown}
          </div>
        </div>
      )}

      {countdown === null && bothJoined && !battleStarted && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <div className="bg-black/70 backdrop-blur-sm px-8 py-3 rounded-2xl border border-amber-500/50">
            <span className="text-amber-300 text-xl font-bold uppercase tracking-wider animate-pulse">
              Both Teams Here — Press Let&apos;s Fight!
            </span>
          </div>
        </div>
      )}

      {battleStarted && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-fade-in">
          <div
            className="text-8xl md:text-[10rem] font-black text-amber-300 battle-text select-none leading-none"
            style={{
              textShadow: '0 0 60px rgba(245,158,11,0.9), 0 0 120px rgba(245,158,11,0.5), 0 0 200px rgba(239,68,68,0.3)',
            }}
          >
            FIGHT!
          </div>
        </div>
      )}
    </div>
  );
}
