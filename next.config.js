/** @type {import('next').NextConfig} */
const repoName = 'svampkartan'; // Change if your repo name is different
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // basePath and assetPrefix removed for local static export
}

module.exports = nextConfig
