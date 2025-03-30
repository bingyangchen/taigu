#!/usr/bin/env bash

# This script is used to initialize the database. It will be executed in the container.
set -e

if [ -z "$APP_DB" ]; then
    printf "\033[0;31mAPP_DB is not set. Please set the APP_DB environment variable.\033[0m\n"
    exit 1
fi

echo "Checking if database $APP_DB exists..."

if psql -lqt | cut -d \| -f 1 | grep -qw "$APP_DB"; then
    printf "\033[0;33mDatabase $APP_DB already exists.\033[0m\n"
else
    echo "Creating database $APP_DB..."
    psql -c "CREATE DATABASE $APP_DB;"
    printf "\033[0;32mDatabase $APP_DB created successfully.\033[0m\n"
fi

printf "\033[0;32mDatabase initialization completed.\033[0m\n"
