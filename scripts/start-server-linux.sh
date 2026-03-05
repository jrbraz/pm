#!/usr/bin/env bash
set -euo pipefail

docker compose up --build -d
echo "Server started at http://127.0.0.1:8000"
