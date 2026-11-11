import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#0a0a1a] text-gray-200 px-4">
      <div className="text-center">
        <div className="text-6xl mb-4">🧙</div>
        <h1 className="text-3xl font-black text-amber-400 mb-2">404 — Page Not Found</h1>
        <p className="text-gray-400 mb-6">This spell does not exist in our spellbook.</p>
        <Link
          href="/"
          className="inline-block px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors"
        >
          Back to Start Fight
        </Link>
      </div>
    </main>
  );
}
