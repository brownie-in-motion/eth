FROM node:19-buster-slim AS builder
WORKDIR /app
COPY package.json yarn.lock .
RUN yarn --frozen-lockfile
COPY . .
RUN yarn build

FROM node:19-buster-slim AS installer
WORKDIR /app
COPY package.json yarn.lock .
RUN yarn --frozen-lockfile --production

FROM node:19-buster-slim
WORKDIR /app
COPY --link --from=builder /app/dist dist
COPY --link --from=installer /app/node_modules node_modules
COPY --link templates templates
COPY --link public public
CMD ["node", "--stack-size=4096", "dist"]
