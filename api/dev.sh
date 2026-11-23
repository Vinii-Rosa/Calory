#!/usr/bin/env bash
# Sobe tudo em container: MySQL + migrations + API com hot reload (http://localhost:3001)
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { cp .env.example .env; echo ".env criado a partir do .env.example"; }

docker compose up --build "$@"
