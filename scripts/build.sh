#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/common.sh"

check_triggered_by_make
load_env_vars

if [ "$1" != "dev" ] && [ "$1" != "prod" ]; then
    printf "${RED}Usage: $0 <dev|prod>${RESET}\n"
    exit 1
fi

file_name="compose.$1.yaml"
docker compose -f $file_name build
