#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/common.sh"

check_triggered_by_make
load_env_vars

if [ "$ENV" = "dev" ]; then
  rm -rf frontend/node_modules/
fi

file_name="compose.$ENV.yaml"
docker compose -f $file_name down
