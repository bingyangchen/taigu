#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/common.sh"

check_triggered_by_make
load_env_vars

if [ "${ENV:-}" = "prod" ]; then
    if [[ -z "${IMAGE_TAG:-}" ]]; then
        printf "${RED} ✗ Production requires IMAGE_TAG (pass IMAGE_TAG=<full git SHA> to make)${RESET}\n" >&2
        exit 1
    fi
fi

file_name="compose.$ENV.yaml"
docker compose -f $file_name up -d

if [ "$ENV" = "dev" ]; then
  xdg-open https://localhost 2>/dev/null || open https://localhost 2>/dev/null || echo "Please open https://localhost in your browser"
fi
