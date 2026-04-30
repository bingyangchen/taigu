#! /usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

check_triggered_by_make
load_env_vars

target_env="${1:-}"
validate_environment "$target_env"

echo "$DOCKER_ACCESS_TOKEN" | docker login --username "$DOCKER_USERNAME" --password-stdin

if [ "$target_env" == "prod" ]; then
    tag="$(resolve_prod_build_image_tag)"
    local_images=("$DOCKER_USERNAME/api-server:$tag" "$DOCKER_USERNAME/scheduler:$tag")
else
    local_images=("$DOCKER_USERNAME/api-server:$target_env" "$DOCKER_USERNAME/frontend:$target_env" "$DOCKER_USERNAME/scheduler:$target_env")
fi

for image in "${local_images[@]}"; do
    if ! docker image inspect "$image" >/dev/null 2>&1; then
        printf "${RED} ✗ Image $image does not exist${RESET}\n" >&2
        exit 1
    fi
done

for image in "${local_images[@]}"; do
    docker push "$image"
done

printf "${GREEN} ✔ All images pushed to the registry${RESET}\n"
