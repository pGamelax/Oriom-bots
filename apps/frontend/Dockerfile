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

# ── Serve stage (nginx) ────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing: todas as rotas desconhecidas retornam index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-main.conf /etc/nginx/nginx.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

CMD ["/docker-entrypoint.sh"]
