#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$(realpath "$0")")/common.sh"

check_triggered_by_make
load_env_vars

target_env="${1:-}"
validate_environment "$target_env"

if [ "$target_env" == "prod" ]; then
    tag="$(resolve_prod_build_image_tag)"
    printf "${BLUE}Production image tag: ${tag}${RESET}\n"
    echo "Building api-server..."
    docker build -t "$DOCKER_USERNAME/api-server:$tag" --target final \
        --build-arg ENVIRONMENT="$target_env" --platform linux/amd64 ./api-server

    echo "Building scheduler..."
    docker build -t "$DOCKER_USERNAME/scheduler:$tag" --target final \
        --build-arg API_SERVER_IMAGE_TAG="$tag" --platform linux/amd64 ./scheduler
else
    arch=$(uname -m)
    echo "Building api-server..."
    docker build -t "$DOCKER_USERNAME/api-server:$target_env" --target final \
        --build-arg ENVIRONMENT="$target_env" --platform linux/$arch ./api-server

    echo "Building frontend..."
    docker build -t "$DOCKER_USERNAME/frontend:$target_env" --target final \
        --platform linux/$arch ./frontend

    echo "Building scheduler..."
    docker build -t "$DOCKER_USERNAME/scheduler:$target_env" --target final \
        --build-arg API_SERVER_IMAGE_TAG="$target_env" --platform linux/$arch ./scheduler
fi

printf "${GREEN} ✔ All images built${RESET}\n"
