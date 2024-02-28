#!/usr/bin/env bash

# Activate virtual Python environment
source $(pipenv --venv)/bin/activate

# Load all environment variables from .env file
set -o allexport
source .env set

pytest ../../

deactivate
