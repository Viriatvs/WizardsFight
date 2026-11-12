'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QRPanel({ roomUrl }: { roomUrl: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(roomUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    }).then(setQrDataUrl).catch(console.error);
  }, [roomUrl]);

  if (!qrDataUrl) {
    return <div className="w-64 h-64 bg-gray-800 animate-pulse" />;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="w-64 h-64 border-4 border-amber-600 shadow-[6px_6px_0_0_rgba(0,0,0,0.7)] bg-white p-2"
        style={{ backgroundImage: `url(${qrDataUrl})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
      />
      <p className="text-sm text-gray-400 font-mono">
        Scan to join —{' '}
        <span className="text-amber-400">{roomUrl.replace(/^https?:\/\//, '')}</span>
      </p>
    </div>
  );
}
