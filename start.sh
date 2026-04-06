#!/usr/bin/env bash
# perplexity-proxy start script
set -e
cd "$(dirname "$0")"

echo "==> Installing Python dependencies..."
pip install -q -r requirements.txt

echo "==> Installing Chromium for Playwright..."
playwright install chromium --with-deps 2>/dev/null || playwright install chromium

echo ""
echo "==> Starting perplexity-proxy on http://localhost:${PORT:-8080}"
echo "    First run : a browser window opens so you can log in."
echo "    After that: runs fully headless."
echo ""

uvicorn server:app --host 0.0.0.0 --port "${PORT:-8080}" --reload
