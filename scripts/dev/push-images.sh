#! /usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

check_triggered_by_make
load_env_vars

if [ "$1" != "dev" ] && [ "$1" != "prod" ]; then
    printf "${RED} ✗ Usage: $0 <dev|prod>${RESET}\n" >&2
    exit 1
fi

echo "$DOCKER_ACCESS_TOKEN" | docker login --username "$DOCKER_USERNAME" --password-stdin
local_images=("$DOCKER_USERNAME/api-server:$1" "$DOCKER_USERNAME/frontend:$1" "$DOCKER_USERNAME/scheduler:$1")

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
