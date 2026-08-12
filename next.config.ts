import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  // Lets a second dev server (the Playwright one) use a separate build
  // directory. Two `next dev` processes sharing .next corrupt each other's
  // chunk manifests, which surfaces as ENOENT on vendor chunks.
  distDir: process.env.NEXT_DIST_DIR || '.next',
}

export default nextConfig
