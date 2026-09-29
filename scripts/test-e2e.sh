#!/bin/bash
set -euo pipefail

# Stable path, NOT a per-run temp dir. `/tmp/playwright-$$` embeds the PID,
# so every run would be a cache miss and re-download ~150MB of Chromium.
# This keeps the browser out of ~/.cache as required AND caches between runs.
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/tmp/mcquest-playwright}"

npx playwright install chromium

# The dev server serves public/data, so the data must exist first.
npm run build:data

# playwright.config.ts owns the dev server through its `webServer` block.
# Do NOT also start `npm run dev` here: two servers race for port 5173,
# the loser exits, and the surviving one is unmanaged by the test runner.
npx playwright test "$@"
