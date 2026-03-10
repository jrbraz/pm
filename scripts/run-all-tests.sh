#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Backend tests ==="
(cd "$ROOT_DIR/backend" && uv run pytest) &
backend_pid=$!

echo "=== Frontend tests ==="
(cd "$ROOT_DIR/frontend" && npm run test:all) &
frontend_pid=$!

backend_exit=0
frontend_exit=0

wait $backend_pid || backend_exit=$?
wait $frontend_pid || frontend_exit=$?

echo ""
if [ $backend_exit -ne 0 ] || [ $frontend_exit -ne 0 ]; then
  [ $backend_exit -ne 0 ] && echo "Backend tests FAILED (exit $backend_exit)"
  [ $frontend_exit -ne 0 ] && echo "Frontend tests FAILED (exit $frontend_exit)"
  exit 1
fi

echo "All tests passed."
