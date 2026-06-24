FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate
COPY package.json pnpm-workspace.yaml ./
COPY services/api/package.json services/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --filter @telefoninho/api... --no-frozen-lockfile
COPY . .
RUN pnpm --filter @telefoninho/api build
CMD ["pnpm", "--filter", "@telefoninho/api", "start"]
