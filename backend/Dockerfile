# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /usr/src/app

COPY package*.json ./
# Install ALL deps (including devDeps for nest CLI)
RUN npm ci

COPY . .

# Generate Prisma client + compile TypeScript
RUN echo 'DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"' > .env
RUN npx prisma generate
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS production

# System dependencies for Playwright Chromium
RUN apt-get update && apt-get install -y \
    ca-certificates fonts-liberation fonts-noto-cjk \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 \
    libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 \
    libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
    libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 \
    libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 \
    libxi6 libxrandr2 libxrender1 libxss1 libxtst6 wget xdg-utils \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy compiled artifacts from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/prisma ./prisma
COPY package*.json ./

# Install Playwright Chromium browser only (no system Chrome needed)
RUN npx playwright install chromium --with-deps

# Session storage directory (mounted as Docker volume)
RUN mkdir -p storage

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
