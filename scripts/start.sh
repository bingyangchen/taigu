#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/common.sh"

check_triggered_by_make
load_env_vars

file_name="compose.$ENV.yaml"
docker compose -f $file_name up -d

xdg-open https://localhost 2>/dev/null || open https://localhost 2>/dev/null || echo "Please open https://localhost in your browser"
