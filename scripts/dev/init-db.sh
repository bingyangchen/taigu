#!/usr/bin/env bash

set -e

create_db_if_not_exists() {
    local db_name="$1"
    echo "Checking if database $db_name exists..."

    if psql -lqt | cut -d \| -f 1 | grep -qw "$db_name"; then
        echo "Database $db_name already exists."
    else
        echo "Creating database $db_name..."
        psql -c "CREATE DATABASE $db_name;"
        echo "Database $db_name created successfully."
    fi
}

create_db_if_not_exists "trade_smartly"

echo "Database initialization completed."
