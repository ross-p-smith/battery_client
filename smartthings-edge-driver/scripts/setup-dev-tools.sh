#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRIVER_DIR="$(dirname "$SCRIPT_DIR")"

# Download SmartThings lua_libs for local development
LUA_LIBS_DIR="$DRIVER_DIR/lua_libs"
if [ ! -d "$LUA_LIBS_DIR" ]; then
  echo "Downloading SmartThings lua_libs (API v19)..."
  curl -L -o /tmp/lua_libs.tar.gz \
    "https://github.com/SmartThingsCommunity/SmartThingsEdgeDrivers/releases/download/apiv19_60_beta/lua_libs-api_v19_60X-beta.tar.gz"
  mkdir -p "$LUA_LIBS_DIR"
  tar -xzf /tmp/lua_libs.tar.gz -C "$LUA_LIBS_DIR" --strip-components=1
  rm /tmp/lua_libs.tar.gz
  echo "lua_libs extracted to $LUA_LIBS_DIR"
else
  echo "lua_libs already present at $LUA_LIBS_DIR"
fi

echo ""
echo "Setup complete. To configure LUA_PATH for development:"
echo "  export LUA_PATH=\"$DRIVER_DIR/src/?.lua;$DRIVER_DIR/src/?/init.lua;$LUA_LIBS_DIR/?.lua;$LUA_LIBS_DIR/?/init.lua;;\""
echo ""
echo "To authenticate SmartThings CLI, use a Personal Access Token:"
echo "  smartthings --token <your-PAT>"
