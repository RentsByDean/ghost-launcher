import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { siteMetadata } from '@ghost/shared/branding';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: siteMetadata.seo.title,
  description: siteMetadata.seo.description,
  openGraph: siteMetadata.openGraph,
  twitter: siteMetadata.twitter,
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


