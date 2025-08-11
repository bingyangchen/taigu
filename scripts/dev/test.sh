#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

# NOTE: Do not call check_triggered_by_make because this script is also called by
#       pre-push hook.

check_env dev

T=""
if [ -z "$MAKELEVEL" ]; then
    T="-T"  # For colorizing output
fi

printf "${BLUE}Running codespell...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm -v "$(pwd):/app:ro" \
  api-server codespell --config=.codespellrc
printf "Passed!\n\n"

printf "${BLUE}Running Ruff...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm -v "$(pwd):/app:ro" \
  api-server ruff check ./api-server/ ./scheduler/ --config=./api-server/ruff.toml --no-cache
printf "\n"

printf "${BLUE}Running Prettier...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm frontend npm run format:check
printf "\n"

printf "${BLUE}Running Pytest...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm api-server pytest
printf "\n"

printf "${BLUE}Running ESLint...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm frontend npm run lint

printf "${GREEN} ✔ All tests passed${RESET}\n"
