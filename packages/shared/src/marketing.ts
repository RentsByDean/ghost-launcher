export type FeatureHighlight = {
  title: string;
  body: string;
  accent: string;
};

export type LaunchStep = {
  title: string;
  body: string;
};

export type Testimonial = {
  quote: string;
  author: string;
  role: string;
};

export const featureHighlights: FeatureHighlight[] = [
  {
    title: 'Spectral Wallet Orchestration',
    body: 'Spinning burner wallets, funding, routing and destruction — fully automated and invisible to on-chain sleuths.',
    accent: 'from-emerald-400/40 via-cyan-400/30 to-sky-500/30',
  },
  {
    title: 'Obfuscated Liquidity',
    body: 'Route contributions through multi-hop mixers with deterministic settlement into launch wallets.',
    accent: 'from-sky-400/30 via-blue-500/20 to-indigo-600/30',
  },
  {
    title: 'Pulse Monitoring',
    body: 'Realtime launch health, bottlenecks and pump-ready triggers surfaced in a minimal console.',
    accent: 'from-zinc-50/10 via-white/5 to-transparent',
  },
  {
    title: 'Privacy Rewards',
    body: 'Claim mechanics that settle to PrivacyCash before reaching your vault—no direct touchpoints.',
    accent: 'from-emerald-400/25 via-teal-400/20 to-transparent',
  },
];

export const launchSteps: LaunchStep[] = [
  {
    title: '01. Whisper',
    body: 'Connect a wallet, pick parameters and Ghost orchestrates burner wallets + settlement paths.',
  },
  {
    title: '02. Drift',
    body: 'We fund, split and shuffle liquidity, preparing multiple deployment wallets without you lifting a finger.',
  },
  {
    title: '03. Manifest',
    body: 'Tokens go live with battle-tested configs, private claim flows and automated monitoring alerts.',
  },
];

export const testimonials: Testimonial[] = [
  {
    quote:
      'Ghost Launcher feels like having an agency trading floor in my browser. The discretion and pacing is unmatched.',
    author: 'Kai, Pump Architect',
    role: 'Studio Nine',
  },
  {
    quote: 'We ship stealth launches weekly. Ghost handles the dangerous plumbing while we focus on narrative.',
    author: 'Sera, DeFi Strategist',
    role: 'Specter Labs',
  },
];

