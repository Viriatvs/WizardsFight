import Link from 'next/link';
import PixelIcon from '@/components/PixelIcon';

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-screen px-4">
      <div className="panel-stone text-center px-8 py-10 max-w-md">
        <div className="text-6xl mb-4"><PixelIcon name="wizardBlue" /></div>
        <h1 className="text-3xl text-amber-400 mb-2">404 — Page not found</h1>
        <p className="text-gray-300 mb-8">This spell does not exist in our spellbook.</p>
        <Link href="/" className="btn-pixel">
          Back to Start Fight
        </Link>
      </div>
    </main>
  );
}
