# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# VITE_API_URL must be provided at build time (baked into the JS bundle)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ── Serve stage (nginx) ────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing: todas as rotas desconhecidas retornam index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
