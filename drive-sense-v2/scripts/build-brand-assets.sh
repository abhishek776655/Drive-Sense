#!/usr/bin/env bash
# Renders the DriveSense logo PNGs from src/brand/logo.ts (spec 2026-10-17, brand logo).
# Re-run after changing the logo geometry; the PNGs are committed, so builds don't need this.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v rsvg-convert >/dev/null; then
  echo "rsvg-convert not found: brew install librsvg" >&2
  exit 1
fi

node scripts/write-brand-svgs.mjs
# -b paints an opaque background: the App Store rejects icons with an alpha channel.
rsvg-convert -w 1024 -h 1024 -b '#000000' assets/brand/icon.svg -o assets/icon.png
rsvg-convert -w 1024 -h 1024 assets/brand/adaptive-foreground.svg -o assets/adaptive-icon.png
rsvg-convert -w 1024 -h 1024 assets/brand/logo-mark.svg -o assets/splash-icon.png
rsvg-convert -w 48 -h 48 assets/brand/logo-tile.svg -o assets/favicon.png
echo "brand PNGs updated"
