export type SiteMetadata = {
  name: string;
  tagline: string;
  description: string;
  seo: {
    title: string;
    description: string;
  };
  openGraph: {
    title: string;
    description: string;
    type: 'website';
  };
  twitter: {
    card: 'summary_large_image';
    title: string;
    description: string;
  };
};

export const siteMetadata: SiteMetadata = {
  name: 'Ghost Launcher',
  tagline: 'Launch spectral tokens with agency-grade discretion.',
  description:
    'Ghost Launcher choreographs wallets, capital flows and monitoring so your Pumpfun release materializes like a whisper—seen only when you want it to be.',
  seo: {
    title: 'Ghost Launcher - Anonymous Token Launches',
    description:
      'Ghost Launcher helps you launch tokens privately without compromising speed or paying exorbitant fees.',
  },
  openGraph: {
    title: 'Ghost Launcher - Anonymous Token Launches',
    description:
      'Ghost Launcher helps you launch tokens privately without compromising speed or paying exorbitant fees.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ghost Launcher - Anonymous Token Launches',
    description:
      'Ghost Launcher helps you launch tokens privately without compromising speed or paying exorbitant fees.',
  },
};

