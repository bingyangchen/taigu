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
    for service in api-server scheduler; do
        echo "Building $service..."
        cd ./$service
        if [ "$service" == "scheduler" ]; then
            docker build -t "$DOCKER_USERNAME/$service:$tag" --target "$target_env"_final \
                --build-arg API_SERVER_IMAGE_TAG="$tag" \
                -f ./Dockerfile --platform linux/x86_64 .
        else
            docker build -t "$DOCKER_USERNAME/$service:$tag" --target "$target_env"_final \
                -f ./Dockerfile --platform linux/x86_64 .
        fi
        cd ..
    done
else
    arch=$(uname -m)
    for service in api-server frontend scheduler; do
        echo "Building $service..."
        cd ./$service
        docker build -t "$DOCKER_USERNAME/$service:$target_env" --target "$target_env"_final \
            -f ./Dockerfile --platform linux/$arch .
        cd ..
    done
fi

printf "${GREEN} ✔ All images built${RESET}\n"
