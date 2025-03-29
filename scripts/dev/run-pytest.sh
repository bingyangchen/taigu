#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

# NOTE: Do not call check_triggered_by_make because this script is also called by
#       pre-push hook.

check_env dev
clear_screen
docker compose -f compose.dev.yaml --progress quiet run --rm api-server pytest
