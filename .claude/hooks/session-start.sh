#!/bin/bash
# Prepares cloud sessions: Node 24 (what CI and the README expect) and the npm dependencies.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

NODE_DIR="$HOME/.local/node24"
if [ ! -x "$NODE_DIR/bin/node" ]; then
  VERSION=$(curl -fsS https://nodejs.org/dist/index.json | node -e '
    const l = JSON.parse(require("fs").readFileSync(0, "utf8")).filter((r) => r.version.startsWith("v24."));
    console.log(l[0].version);')
  mkdir -p "$NODE_DIR"
  curl -fsS "https://nodejs.org/dist/$VERSION/node-$VERSION-linux-x64.tar.xz" | tar -xJ -C "$NODE_DIR" --strip-components=1
fi
export PATH="$NODE_DIR/bin:$PATH"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$NODE_DIR/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

npm install --no-audit --no-fund
