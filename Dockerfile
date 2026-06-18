# syntax=docker/dockerfile:1

FROM node:22-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV OZON_BROWSER_PROFILE_PATH=/app/browser-profile

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npx playwright install chromium \
  && npx playwright install-deps chromium

COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data /app/browser-profile

EXPOSE 3001
VOLUME ["/app/data", "/app/browser-profile"]

CMD ["node", "dist/index.js"]
