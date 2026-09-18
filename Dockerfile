FROM node:22-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm build

FROM base AS supabase-cli
WORKDIR /cli
RUN npm install --omit=dev --no-save supabase@2.117.0

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nuxt

COPY --from=builder /app/.output ./.output
COPY --from=supabase-cli /cli/node_modules ./node_modules
COPY supabase ./supabase
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nuxt

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV HOME=/tmp

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
