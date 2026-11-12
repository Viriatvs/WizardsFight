'use client';

import { useEffect, useState } from 'react';

/** How long the "Copied!" confirmation stays visible. */
const FEEDBACK_MS = 2000;

/** Icon button that copies `url` to the clipboard, with visible and screen-reader feedback. */
export default function CopyLinkButton({ url }: { url: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (status === 'idle') return;
    const t = setTimeout(() => setStatus('idle'), FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [status]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('copied');
    } catch (err) {
      // Clipboard API is missing or blocked (e.g. a non-HTTPS page): tell the user how to copy by hand.
      console.error('Copy link failed', err);
      setStatus('failed');
    }
  };

  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <button
        type="button"
        onClick={copy}
        aria-label="Copy room link"
        title="Copy room link"
        className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-gray-800
          focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
      >
        {status === 'copied' ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
        )}
      </button>
      <span role="status" aria-live="polite" className="text-xs">
        {status === 'copied' && <span className="text-emerald-400">Copied!</span>}
        {status === 'failed' && <span className="text-red-400">Couldn&apos;t copy. Long-press the link to copy it.</span>}
      </span>
    </span>
  );
}
