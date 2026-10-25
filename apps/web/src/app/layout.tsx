import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://zoopie.chat'),
  title: {
    template: '%s | Zoopie',
    default: 'Zoopie — Friendly, Modern Real-Time Chat',
  },
  description:
    'Instant, friendly, and privacy-focused peer-to-peer video and text connections with people who share your curiosity. No account required.',
  keywords: [
    'zoopie',
    'real-time video',
    'peer to peer',
    'video chat',
    'text chat',
    'shared interests',
    'social discovery',
  ],
  authors: [{ name: 'Zoopie Team' }],
  openGraph: {
    title: 'Zoopie — Friendly, Modern Real-Time Chat',
    description:
      'Connect spontaneously with people who share your curiosity. Private, peer-to-peer, and zero clutter.',
    url: '/',
    siteName: 'Zoopie',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zoopie — Friendly, Modern Real-Time Chat',
    description:
      'Connect spontaneously with people who share your curiosity. Private, peer-to-peer, and zero clutter.',
  },
  icons: {
    icon: '/icon',
  },
};

export const viewport: Viewport = {
  themeColor: '#070b12',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen bg-surface-950 text-surface-100 flex flex-col antialiased selection:bg-brand-500/30 selection:text-white">
        <Navbar />
        <main className="flex-1 w-full flex flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
