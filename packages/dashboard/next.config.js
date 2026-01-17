/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for better monorepo support
  transpilePackages: ['@orkestra/api'],

  // Configure for standalone output (useful for Docker)
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,

  // Environment variables that are exposed to the browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/trpc',
  },
};

export default nextConfig;
