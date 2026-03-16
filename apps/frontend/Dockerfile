# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# VITE_API_URL must be provided at build time (baked into the JS bundle)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package.json ./
RUN npm install --ignore-scripts

COPY . .
RUN npm run build

# ── Serve stage (caddy) ────────────────────────────────────────────────────────
FROM caddy:2-alpine

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY --from=builder /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
