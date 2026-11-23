#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose up -d mysql

echo "Aguardando MySQL ficar saudável..."
until [ "$(docker inspect -f '{{.State.Health.Status}}' calory-mysql 2>/dev/null)" = "healthy" ]; do
  sleep 2
done
echo "MySQL pronto na porta 3307."
