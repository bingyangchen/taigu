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
docker compose -f compose.dev.yaml --progress quiet run $T --rm -v "$(pwd):/app:ro" \
  api-server codespell --config=.codespellrc
printf "Passed!\n\n"

printf "${BLUE}Running ruff...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm -v "$(pwd):/app:ro" \
  api-server ruff check ./api-server/ ./scheduler/ --config=./api-server/ruff.toml --no-cache
# Ruff will echo passed by default.
printf "\n"

printf "${BLUE}Running prettier and eslint...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm frontend bash -c \
  "npm run format:check && npm run lint"
printf "Passed!\n\n"

printf "${BLUE}Running pytest...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm api-server pytest
printf "Passed!\n"