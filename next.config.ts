/** @type {import('next').NextConfig} */

// Security headers on every response (COMPLIANCE.md, "Hardened edges"). The
// content-security-policy is deliberately limited to what cannot break the app:
// no framing, no plugins, no foreign form targets or base URLs. Dynamic pages
// already go out with Cache-Control: no-store from Next itself.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

const nextConfig = {
  output: 'standalone', // self-contained server bundle for Cloud Run / containers (see DEPLOY.md)
  poweredByHeader: false,
  serverExternalPackages: ['@anthropic-ai/sdk', 'node-x12', 'pg'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig
