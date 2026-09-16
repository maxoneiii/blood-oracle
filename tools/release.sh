#!/usr/bin/env bash
# Builds the module and packs exactly what a Foundry install needs.
#
# The rules reference is deliberately absent: it is book text, it lives in
# Foundry's Data directory, and every client fetches it from the server.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./module.json').version")
OUT="build"

npm run build

rm -rf "$OUT"
mkdir -p "$OUT/blood-oracle"

cp -r module.json dist icons fonts README.md RULES.md LICENSE "$OUT/blood-oracle/"

cd "$OUT"
zip -rq module.zip blood-oracle
cp blood-oracle/module.json module.json

echo
echo "Packed version $VERSION"
echo "  $OUT/module.zip     — attach to the release"
echo "  $OUT/module.json    — attach to the release"
