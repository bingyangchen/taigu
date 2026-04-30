#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$(realpath "$0")")/common.sh"

check_triggered_by_make
load_env_vars

deployment_environment="${ENV:?Set ENV=dev or prod in .env or environment}"
if [ "$deployment_environment" = "prod" ]; then
    export IMAGE_TAG="$(resolve_prod_pull_image_tag)"
fi

file_name="compose.$deployment_environment.yaml"
docker compose -f "$file_name" down
