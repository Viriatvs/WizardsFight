import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wizards Fight',
  description: 'A real-time spell-casting duel for two wizards.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0a0a1a] text-gray-200">{children}</body>
    </html>
  );
}
