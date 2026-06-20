# CodeCompanion — container image for Google Cloud Run (Next.js standalone).
# Build:  docker build -t codecompanion .
# Run:    docker run -p 8080:8080 --env-file .env.local codecompanion
# See DEPLOY.md for the full Cloud Run + Neon + Supabase-Auth deploy.

# 1) Install deps
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 2) Build the standalone server (mock-first; no PHI/secrets needed at build)
FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3) Minimal runtime — only the standalone output
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# Run as non-root
RUN useradd --uid 10001 --no-create-home appuser
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER appuser
# Cloud Run injects PORT (default 8080); Next's standalone server honors it.
ENV PORT=8080 HOSTNAME=0.0.0.0
EXPOSE 8080
CMD ["node", "server.js"]
