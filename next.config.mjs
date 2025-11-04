/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Ensure these heavy/native deps are treated as external for server bundling
    serverComponentsExternalPackages: ['privacycash', '@lightprotocol/hasher.rs'],
  },
};

export default nextConfig;


