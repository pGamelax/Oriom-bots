# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --ignore-scripts

# Generate Prisma client before compiling
COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Only production deps
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

# Prisma client and schema (needed at runtime)
COPY prisma ./prisma/
RUN npx prisma generate

# Compiled output
COPY --from=builder /app/dist ./dist/

EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
