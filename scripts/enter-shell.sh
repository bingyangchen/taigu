#!/usr/bin/env bash

set -e
source ./scripts/common.sh

validate_service $1
load_env
clear_screen
if [ "$1" = "db" ] || [ "$1" = "redis" ]; then
    # For db and redis, creating a new container will make it unable to connect to postgres/redis
    # So we need to use exec to get a shell from the existing container.
    docker compose -f compose.$ENV.yaml --progress quiet exec $1 bash
else
    docker compose -f compose.$ENV.yaml --progress quiet run --rm $1 bash
fi
