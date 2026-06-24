FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate
COPY package.json pnpm-workspace.yaml ./
COPY apps/parent-web/package.json apps/parent-web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --filter @telefoninho/parent-web... --no-frozen-lockfile
COPY . .
RUN pnpm --filter @telefoninho/parent-web build
CMD ["pnpm", "--filter", "@telefoninho/parent-web", "start"]
