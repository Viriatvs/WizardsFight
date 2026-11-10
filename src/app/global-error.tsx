'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex items-center justify-center min-h-screen bg-[#0a0a1a] text-gray-200 font-sans">
        <div className="text-center max-w-md px-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-amber-400 mb-2">Something went wrong</h1>
          <p className="text-gray-400 text-sm mb-6">
            An unexpected error occurred. Try refreshing the page.
          </p>
          <button
            onClick={reset}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
