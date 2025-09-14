/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Router is now stable and default in Next.js 13+
  typescript: {
    // Temporarily ignore build errors for production build
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignore ESLint errors during builds
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
