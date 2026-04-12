FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY tsconfig*.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/extension/package.json ./apps/extension/package.json
COPY apps/mcp-server/package.json ./apps/mcp-server/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/engine/package.json ./packages/engine/package.json
COPY packages/providers/package.json ./packages/providers/package.json
COPY packages/renderers/package.json ./packages/renderers/package.json
RUN npm install --workspaces --include-workspace-root

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build:api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app .
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace=@diotest/api"]
