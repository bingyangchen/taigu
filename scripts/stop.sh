#!/usr/bin/env bash

set -e
source ./scripts/common.sh

load_env
file_name="compose.$ENV.yaml"
docker compose -f $file_name down
