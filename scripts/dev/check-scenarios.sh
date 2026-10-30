#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$(realpath "$0")")/../common.sh"

load_env_vars
check_env dev

frontend_report=$(mktemp)
trap 'rm -f "$frontend_report"' EXIT

docker compose -f compose.dev.yaml --progress quiet run --rm --no-deps -v "$(pwd):/workspace:ro" \
  frontend node --test /workspace/scripts/sdd/frontend_scenarios.test.cjs
docker compose -f compose.dev.yaml --progress quiet run --rm --no-deps -v "$(pwd):/workspace:ro" \
  frontend node /workspace/scripts/sdd/frontend_scenarios.cjs /app > "$frontend_report"
docker compose -f compose.dev.yaml --progress quiet run --rm --no-deps -v "$(pwd):/app:ro" \
  -v "$frontend_report:/frontend-scenarios.json:ro" -e PYTHONDONTWRITEBYTECODE=1 \
  api-server sh -c 'pytest -p no:django -p no:cacheprovider -q scripts/sdd && python scripts/sdd/check_scenarios.py --frontend-report /frontend-scenarios.json'
