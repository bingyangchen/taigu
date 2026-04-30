#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/common.sh"

check_triggered_by_make
load_env_vars

if [[ -n "${image_tag:-}" ]]; then
    export IMAGE_TAG="$image_tag"
fi

validate_deployment_environment "$1"

if [ "$1" == "prod" ]; then
    tag="$(resolve_prod_build_image_tag)"
    printf "${BLUE}Production image tag: ${tag}${RESET}\n"
    for service in api-server scheduler; do
        echo "Building $service..."
        cd ./$service
        if [ "$service" == "scheduler" ]; then
            docker build -t "$DOCKER_USERNAME/$service:$tag" --target "$1"_final \
                --build-arg API_SERVER_IMAGE_TAG="$tag" \
                -f ./Dockerfile --platform linux/x86_64 .
        else
            docker build -t "$DOCKER_USERNAME/$service:$tag" --target "$1"_final \
                -f ./Dockerfile --platform linux/x86_64 .
        fi
        cd ..
    done
else
    arch=$(uname -m)
    for service in api-server frontend scheduler; do
        echo "Building $service..."
        cd ./$service
        docker build -t "$DOCKER_USERNAME/$service:$1" --target "$1"_final \
            -f ./Dockerfile --platform linux/$arch .
        cd ..
    done
fi

printf "${GREEN} ✔ All images built${RESET}\n"
