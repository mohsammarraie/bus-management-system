FROM node:24.22.2-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS build
WORKDIR /workspace
RUN npm install --global npm@11.19.1
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY angular.json tsconfig*.json ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM caddy:2-alpine@sha256:78bd35025c7ba85961dd149ae670315129954e77abe2383ac47c89106b35ade9
ENV XDG_CONFIG_HOME=/tmp/config XDG_DATA_HOME=/tmp/data
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /workspace/dist/bus-management-system/browser /srv
USER 10001:10001
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
