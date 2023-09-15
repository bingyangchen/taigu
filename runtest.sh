# load all environment variables from .env file
set -o allexport
source .env set
+o allexport

# pass all arguments and options to pytest
args_and_opts="$@"
pytest $args_and_opts
