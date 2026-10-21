#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$(realpath "$0")")/../common.sh"

require_triggered_by_make
load_env_vars
check_env dev

docker compose -f compose.dev.yaml --progress quiet run --rm --no-deps -v "$(pwd):/app:ro" \
  -e PYTHONDONTWRITEBYTECODE=1 api-server python scripts/sdd/check_scenarios.py
