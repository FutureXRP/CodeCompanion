/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // self-contained server bundle for Cloud Run / containers (see DEPLOY.md)
  serverExternalPackages: ['@anthropic-ai/sdk', 'node-x12', 'pg'],
}

module.exports = nextConfig
