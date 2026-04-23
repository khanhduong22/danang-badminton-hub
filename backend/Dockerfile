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

# Xóa toàn bộ devDependencies (như typescript, nest CLI, jest) để giảm dung lượng node_modules
RUN npm prune --omit=dev

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS production

# Cài đặt system dependencies cho Playwright Chromium.
# Đặt bước này lên CÙNG của production để TẬN DỤNG CACHE TỐI ĐA (vì hiếm khi thay đổi apt packages)
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

COPY package*.json ./
# Copy node_modules ĐÃ ĐƯỢC LỌC (chỉ còn thư viện production) từ builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Cài đặt Playwright Chromium (Cực nặng ~500MB).
# Đặt TRƯỚC khi copy source code để đảm bảo KHÔNG BAO GIỜ bị tải lại mỗi khi bác sửa code!
RUN npx playwright install chromium --with-deps

# CUỐI CÙNG mới copy thư mục dist và prisma.
# Bất kỳ khi nào bác sửa code ở thư mục src/, Docker CHỈ build lại duy nhất layer này (vài MB).
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

# Session storage directory (mounted as Docker volume)
RUN mkdir -p storage

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
