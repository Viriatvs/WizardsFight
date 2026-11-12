import type { Metadata } from 'next';
import { Pixelify_Sans, Alegreya_Sans } from 'next/font/google';
import './globals.css';

// Self-hosted at build time by next/font: no request to Google when a page loads.
const pixel = Pixelify_Sans({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-pixel', display: 'swap' });
const body = Alegreya_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: 'Wizards Fight',
  description: 'A real-time spell-casting duel for two wizards.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${pixel.variable} ${body.variable}`}>
      <body className="min-h-full flex flex-col text-gray-100">{children}</body>
    </html>
  );
}
