#!/usr/bin/env bash
# Chennai Relief Control - starts the API (port 8765) and the web app (port 5273).
set -e
cd "$(dirname "$0")"
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install -q -r backend/requirements.txt
[ -d frontend/node_modules ] || (cd frontend && npm install)
python -m uvicorn backend.main:app --port 8765 &
API=$!
trap 'kill $API' EXIT
cd frontend && npm run dev
