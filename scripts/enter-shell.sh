#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/common.sh"

validate_service $1
load_env
clear_screen
if [ "$1" = "db" ] || [ "$1" = "redis" ]; then
    # For db and redis, a newly created container would not be able to connect to the running postgres/redis
    # So we use 'exec' to get a shell in the existing container instead of creating a new one
    docker compose -f compose.$ENV.yaml --progress quiet exec $1 bash
else
    docker compose -f compose.$ENV.yaml --progress quiet run --rm $1 bash
fi
