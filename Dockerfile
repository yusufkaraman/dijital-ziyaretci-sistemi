FROM node:22-alpine AS base
WORKDIR /app

# Sadece bağımlılık dosyalarını kopyala (cache layer)
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Tüm bağımlılıkları kur, Prisma client üret, sonra dev bağımlılıkları temizle
RUN npm ci && \
    npx prisma generate && \
    npm prune --omit=dev && \
    npm cache clean --force

# Uygulama dosyalarını kopyala
COPY server ./server/
COPY public ./public/

# Upload dizinini oluştur
RUN mkdir -p /app/server/uploads

# Güvenlik: root olmayan kullanıcı
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
ENV TZ=Europe/Istanbul

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server/index.js"]
