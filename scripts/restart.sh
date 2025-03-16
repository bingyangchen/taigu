#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/common.sh"

load_env
file_name="compose.$ENV.yaml"
docker compose -f $file_name up -d --force-recreate

printf "\n${BLUE}Removing unused containers, networks and images...${RESET}\n"
docker system prune -f
