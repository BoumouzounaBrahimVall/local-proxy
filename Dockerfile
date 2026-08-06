# ---- Builder : compiles the source code and generates the production build ----
# Pinned to the *build* platform so the compile runs natively once instead of
# once per target architecture, the second one emulated through QEMU. Safe here
# because the output is architecture independent: the build is a plain tsup
# compile and every production dependency is pure JavaScript, so nothing in
# dist/ or the pruned node_modules carries a native binary.
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

WORKDIR /app

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
COPY templates ./templates

RUN pnpm build && pnpm prune --prod

# ---- Runtime : runs the production build ----
FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/templates ./templates
COPY package.json ./

# /workspace is the mount point for scenarios.json and fixtures, and is where
# --init writes; it must be owned by the unprivileged user that runs the process
RUN mkdir -p /workspace && chown node:node /workspace
WORKDIR /workspace

# default listening port; override with PORT or --port (compose maps both sides)
EXPOSE 5050
USER node

# no CMD: an explicit "--help" default would override TARGET from the environment
# and make the container exit immediately. With no args the CLI resolves target
# from TARGET, and still prints help when neither that nor --target is set.
ENTRYPOINT ["node", "/app/dist/cli.js"]
