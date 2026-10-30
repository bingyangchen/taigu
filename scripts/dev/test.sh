#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$(realpath "$0")")/../common.sh"

# NOTE: Do not call require_triggered_by_make because this script is also called by
#       pre-push hook.

load_env_vars
check_env dev

T=""
if [ -z "${MAKELEVEL:-}" ]; then
    T="-T"  # For colorizing output
fi

printf "${BLUE}Running codespell...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm -v "$(pwd):/app:ro" \
  api-server codespell --config=.codespellrc
printf "Passed!\n\n"

printf "${BLUE}Running Ruff...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm -v "$(pwd):/app:ro" \
  api-server ruff check ./api-server/ ./scheduler/ --config=./api-server/ruff.toml --no-cache
docker compose -f compose.dev.yaml --progress quiet run $T --rm -v "$(pwd):/app:ro" \
  api-server ruff format --check ./api-server/ ./scheduler/ --config=./api-server/ruff.toml --no-cache
printf "\n"

printf "${BLUE}Running Prettier...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm frontend npm run format:check
printf "\n"

printf "${BLUE}Running frontend tests...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm --no-deps \
  -e CI=true frontend npm test -- --runInBand
printf "\n"

printf "${BLUE}Running Pytest...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm api-server pytest
printf "\n"

printf "${BLUE}Checking spec scenarios...${RESET}\n"
bash ./scripts/dev/check-scenarios.sh
printf "\n"

printf "${BLUE}Running ESLint...${RESET}\n"
docker compose -f compose.dev.yaml --progress quiet run $T --rm frontend npm run lint

printf "${GREEN} ✔ All tests passed${RESET}\n"
