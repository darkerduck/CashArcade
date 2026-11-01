#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
node --version
node --check drift/engine.js
node --check drift/game.js
node --test tests/drift-*.test.mjs
node --test tests/*.test.mjs
if [ -d .git ]; then git diff --check; fi
