#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="pm-mvp:local"
CONTAINER_NAME="pm-mvp"

cd "$ROOT_DIR"

docker build -t "$IMAGE_NAME" .

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

docker run -d \
  --name "$CONTAINER_NAME" \
  --env-file "$ROOT_DIR/.env" \
  -p 8000:8000 \
  "$IMAGE_NAME"

echo "Started $CONTAINER_NAME on http://localhost:8000"
