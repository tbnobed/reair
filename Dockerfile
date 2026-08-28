FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY artifacts ./artifacts
COPY lib ./lib
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
ENV PORT=8080
ENV BASE_PATH=/
RUN pnpm --filter @workspace/reair-viewer run build
RUN pnpm --filter @workspace/api-server run build

FROM node:24-bookworm-slim AS api

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/lib/db ./lib/db
COPY --from=build /app/artifacts/api-server/package.json ./artifacts/api-server/package.json
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh
ENV NODE_ENV=production
ENV PORT=5000
ENV STORAGE_DIR=/data/uploads
VOLUME ["/data/uploads"]
EXPOSE 5000
ENTRYPOINT ["./docker-entrypoint.sh"]

FROM nginx:1.27-alpine AS web
COPY --from=build /app/artifacts/reair-viewer/dist/public /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80