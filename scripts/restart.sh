#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$(realpath "$0")")/common.sh"

check_triggered_by_make
load_env_vars

deployment_environment="${ENV:?Set ENV=dev or prod in .env or environment}"
if [ "$deployment_environment" = "prod" ]; then
    export IMAGE_TAG="$(resolve_prod_pull_image_tag)"
fi

RECYCLE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --recycle)
            RECYCLE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--recycle]"
            exit 1
            ;;
    esac
done

file_name="compose.$deployment_environment.yaml"
docker compose -f "$file_name" up -d --force-recreate

if [ "$RECYCLE" = true ]; then
    printf "\n${BLUE}Removing unused containers, networks and images...${RESET}\n"
    docker system prune -f
    docker images --filter "reference=${DOCKER_USERNAME}/*" -q | while read -r id; do docker rmi "$id" 2>/dev/null || true; done
fi

printf "${GREEN} ✔ All services restarted${RESET}\n"
