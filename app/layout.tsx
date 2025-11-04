import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Ghost Launcher - Anonymous Token Launches',
  description: 'Ghost Launcher helps you launch tokens privately without compromising speed or paying exorbitant fees.',
  openGraph: {
    title: 'Ghost Launcher - Anonymous Token Launches',
    description: 'Ghost Launcher helps you launch tokens privately without compromising speed or paying exorbitant fees.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ghost Launcher - Anonymous Token Launches',
    description: 'Ghost Launcher helps you launch tokens privately without compromising speed or paying exorbitant fees.',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}


