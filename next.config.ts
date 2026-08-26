import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  // Lets a second dev server (the Playwright one) use a separate build
  // directory. Two `next dev` processes sharing .next corrupt each other's
  // chunk manifests, which surfaces as ENOENT on vendor chunks.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // Testing the phone layout means opening the dev server from an actual phone,
  // which reaches it on the laptop's LAN address rather than localhost. Next
  // treats that as a cross-origin request for `/_next/*` and warns.
  //
  // Dev only. This has no effect on a production build, where the app is
  // served from its own origin.
  //
  // Two things worth knowing before editing this list:
  //
  //   - Declaring it flips the behaviour from warn to BLOCK. Next's rule is
  //     `mode = typeof allowedDevOrigins === 'undefined' ? 'warn' : 'block'`,
  //     so an address that isn't matched here no longer merely complains, it
  //     fails to load chunks. Any new network needs adding rather than ignoring.
  //   - Patterns are matched segment-wise on dots, so an IPv4 address behaves
  //     like a hostname and `*` covers exactly one segment. Hence the /24
  //     wildcards below: DHCP hands out a different final octet often enough
  //     that pinning whole addresses would break this every few weeks.
  //
  // The loopback literals are listed because only the NAME `localhost` is
  // allowed implicitly. `127.0.0.1` and `[::1]` are ordinary hostnames to the
  // matcher and would start being blocked the moment this key exists.
  //
  // Home routers hand out one of these three private ranges almost without
  // exception; a phone hotspot or a café network will not be in them.
  allowedDevOrigins: [
    '127.0.0.1',
    '::1',
    '192.168.0.*',
    '192.168.1.*',
    '10.0.0.*',
  ],
}

export default nextConfig
