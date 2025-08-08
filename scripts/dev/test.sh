#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

# NOTE: Do not call check_triggered_by_make because this script is also called by
#       pre-push hook.

check_env dev

T=""
if [ -z "$MAKELEVEL" ]; then
    T="-T"
fi

printf "${BLUE}Running codespell...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm api-server codespell
echo Passed

printf "${BLUE}Running ruff...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm api-server \
  ruff check . --config=ruff.toml --no-cache
# Ruff will echo passed by default.

printf "${BLUE}Running pytest...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm api-server pytest
