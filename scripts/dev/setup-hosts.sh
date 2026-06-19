#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$(realpath "$0")")/../common.sh"

require_triggered_by_make
load_env_vars
check_env dev

HOSTS_LINE="127.0.0.1 local.taigu.tw"
HOSTS_FILE="/etc/hosts"

if grep -q "local.taigu.tw" "$HOSTS_FILE"; then
    printf "${GREEN} ✓ 'local.taigu.tw' is already configured in $HOSTS_FILE.${RESET}\n"
else
    printf "${YELLOW}Adding 'local.taigu.tw' to $HOSTS_FILE... (requires sudo)${RESET}\n"
    sudo sh -c "echo '' >> $HOSTS_FILE"
    sudo sh -c "echo '# Taigu Development' >> $HOSTS_FILE"
    sudo sh -c "echo '$HOSTS_LINE' >> $HOSTS_FILE"

    # Flush DNS cache on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        printf "${BLUE}Flushing DNS cache...${RESET}\n"
        sudo dscacheutil -flushcache
        sudo killall -HUP mDNSResponder || true
    fi
    printf "${GREEN} ✓ Successfully added 'local.taigu.tw' to $HOSTS_FILE.${RESET}\n"
fi
