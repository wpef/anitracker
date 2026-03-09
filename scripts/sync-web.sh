#!/usr/bin/env bash
# Copies web assets into www/ for Capacitor native builds.
# No build step — just mirror the source files.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WWW="$ROOT/www"

rm -rf "$WWW"
mkdir -p "$WWW"

# Copy web files using cp (rsync not always available)
EXCLUDE="node_modules ios android www .git .github .githooks .claude scripts package.json package-lock.json capacitor.config.json"

for item in "$ROOT"/*; do
  name="$(basename "$item")"
  skip=false
  for ex in $EXCLUDE; do
    if [ "$name" = "$ex" ]; then
      skip=true
      break
    fi
  done
  # Skip markdown files and other dev-only files
  case "$name" in
    *.md) skip=true ;;
    generate-icons.js) skip=true ;;
    netlify.toml) skip=true ;;
  esac
  if [ "$skip" = false ]; then
    cp -r "$item" "$WWW/"
  fi
done

# Copy hidden files we need (none currently)
echo "✔ Web assets synced to www/"
