FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
# Do not run Convex codegen in Railway build; rely on committed convex/_generated files
ENV CONVEX_DEPLOYMENT=
RUN pnpm build

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
