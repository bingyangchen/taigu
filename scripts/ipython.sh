#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/common.sh"

check_triggered_by_make
load_env_vars
clear_screen

docker compose -f compose.$ENV.yaml --progress quiet run --rm api-server python manage.py shell
