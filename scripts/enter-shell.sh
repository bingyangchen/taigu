#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$(realpath "$0")")/common.sh"

check_triggered_by_make
service="${1:-}"
validate_service "$service"
load_env_vars
clear_screen

deployment_environment="${ENV:?Set ENV=dev or prod in .env or environment}"
if [ "$deployment_environment" = "prod" ]; then
    export IMAGE_TAG="$(resolve_prod_pull_image_tag)"
fi

# NOTE:
# For db and redis, a newly created container would not be able to connect to the
# running postgres/redis. So we use 'exec' to get a shell in the existing container
# instead of creating a new one.
if [ "$service" = "db" ]; then
    docker compose -f "compose.$deployment_environment.yaml" --progress quiet exec "$service" bash
elif [ "$service" = "redis" ]; then
    docker compose -f "compose.$deployment_environment.yaml" --progress quiet exec "$service" sh
else
    docker compose -f "compose.$deployment_environment.yaml" --progress quiet run --rm "$service" bash
fi
