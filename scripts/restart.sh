#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/common.sh"

check_triggered_by_make
load_env_vars

if [ "$ENV" = "dev" ]; then
  rm -rf frontend/node_modules/
fi

file_name="compose.$ENV.yaml"
docker compose -f $file_name up -d --force-recreate

printf "\n${BLUE}Removing unused containers, networks and images...${RESET}\n"
docker system prune -f
printf "${GREEN}Done${RESET}\n"
