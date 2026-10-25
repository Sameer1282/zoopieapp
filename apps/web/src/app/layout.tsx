import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/navbar';

export const metadata: Metadata = {
  title: 'Zoopie — Real-Time Interactive Platform',
  description: 'Phase 1 Foundation and Architecture for Zoopie real-time application',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-primary-500/30 selection:text-white">
        <div className="relative min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
            <p>Zoopie Platform &bull; Phase 1 — Project Foundation & Architecture</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
