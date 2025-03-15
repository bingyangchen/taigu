#!/usr/bin/env bash

file_name="compose.$1.yaml"
docker compose -f $file_name down
