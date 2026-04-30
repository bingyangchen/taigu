#! /usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

check_triggered_by_make
check_env prod
load_env_vars
validate_deployment_environment "$1"

if [ "$1" == "prod" ]; then
    if [[ -n "${image_tag:-}" ]]; then
        export IMAGE_TAG="$image_tag"
    fi
fi

echo "$DOCKER_ACCESS_TOKEN" | docker login --username "$DOCKER_USERNAME" --password-stdin

if [ "$1" == "prod" ]; then
    tag="$(resolve_prod_pull_image_tag)"
    remote_images=("$DOCKER_USERNAME/api-server:$tag" "$DOCKER_USERNAME/scheduler:$tag")
else
    remote_images=("$DOCKER_USERNAME/api-server:$1" "$DOCKER_USERNAME/frontend:$1" "$DOCKER_USERNAME/scheduler:$1")
fi

for image in "${remote_images[@]}"; do
    docker pull "$image"
done

printf "${GREEN} ✔ All images pulled from the registry${RESET}\n"
