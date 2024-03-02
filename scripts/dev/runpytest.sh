#!/usr/bin/env bash

# You should run this script at the root directory of this project.

# Activate virtual Python environment
source $(pipenv --venv)/bin/activate

# Load all environment variables from .env file
set -o allexport
source .env set

pytest

deactivate
