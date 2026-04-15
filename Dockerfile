FROM node:20-alpine AS base
WORKDIR /app

# Install server deps
FROM base AS server-deps
COPY server/package*.json ./server/
RUN cd server && npm ci

# Install client deps and build
FROM base AS client-build
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && npm run build

# Build server
FROM base AS server-build
COPY server/package*.json ./server/
RUN cd server && npm ci
COPY server/ ./server/
RUN cd server && npm run build

# Final image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/package.json ./server/package.json
COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 3000
CMD ["node", "server/dist/index.js"]
