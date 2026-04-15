FROM mcr.microsoft.com/devcontainers/typescript-node:24

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        mosquitto-clients \
        lua5.3 \
        liblua5.3-dev \
        luarocks \
    && rm -rf /var/lib/apt/lists/* \
    && luarocks install luacheck
