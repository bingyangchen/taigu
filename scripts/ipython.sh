#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$(realpath "$0")")/common.sh"

check_triggered_by_make
load_env_vars
clear_screen

deployment_environment="${ENV:?Set ENV=dev or prod in .env or environment}"
if [ "$deployment_environment" = "prod" ]; then
    export IMAGE_TAG="$(resolve_prod_pull_image_tag)"
fi

docker compose -f "compose.$deployment_environment.yaml" --progress quiet run --rm api-server python manage.py shell
