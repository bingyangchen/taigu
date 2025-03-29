#! /usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

check_triggered_by_make
check_env prod
load_env_vars

if [ "$1" != "dev" ] && [ "$1" != "prod" ]; then
    printf "${RED}Usage: $0 <dev|prod>${RESET}\n"
    exit 1
fi

echo "$DOCKER_ACCESS_TOKEN" | docker login --username "$DOCKER_USERNAME" --password-stdin
remote_images=("$DOCKER_USERNAME/api-server:$1" "$DOCKER_USERNAME/frontend:$1" "$DOCKER_USERNAME/scheduler:$1")

for image in "${remote_images[@]}"; do
    docker pull "$image"
done

printf "${GREEN} ✔ Images pulled${RESET}\n"
