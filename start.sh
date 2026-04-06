#!/usr/bin/env bash
# perplexity-proxy start script
set -e
cd "$(dirname "$0")"

VENV_DIR=".venv"

# Create venv if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
  echo "==> Creating virtual environment..."
  python3 -m venv "$VENV_DIR"
fi

# Activate venv
source "$VENV_DIR/bin/activate"

echo "==> Installing Python dependencies..."
pip install -q -r requirements.txt

echo "==> Installing Chromium for Playwright..."
playwright install chromium 2>/dev/null || true

echo ""
echo "==> Starting perplexity-proxy on http://localhost:${PORT:-8080}"
echo "    First run : a browser window opens so you can log in."
echo "    After that: runs fully headless."
echo ""

uvicorn server:app --host 0.0.0.0 --port "${PORT:-8080}" --reload
