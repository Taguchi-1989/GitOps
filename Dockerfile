# ============================================================
# Stage 1: Base image
# ============================================================
FROM node:18-alpine AS base
RUN apk add --no-cache git openssl

# ============================================================
# Stage 2: Install dependencies
# ============================================================
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY prisma ./prisma
RUN npx prisma generate

# ============================================================
# Stage 3: Build the application
# ============================================================
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL required at build time for Prisma prerendering
ENV DATABASE_URL="file:./build.db"
RUN npx prisma generate
RUN npx prisma db push --skip-generate
RUN npm run build

# ============================================================
# Stage 4: Production runner
# ============================================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Create non-root user (K8s Pod Security Standards compliant)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema + engine + CLI (not included in standalone output)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy spec directory as default seed data
COPY --from=builder /app/spec ./spec.default

# Copy entrypoint script (fix Windows CRLF line endings)
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

# Create directories for volumes (including .git so Docker initializes with correct ownership)
RUN mkdir -p /app/data /app/spec /app/.git && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
