SHELL := /usr/bin/bash

.PHONY: build
build:
	$(SHELL) ./scripts/build.sh

.PHONY: start
start:
	$(SHELL) ./scripts/start.sh

.PHONY: stop
stop:
	$(SHELL) ./scripts/stop.sh

.PHONY: restart
restart:
	$(SHELL) ./scripts/restart.sh

# shell-api-server | shell-frontend | shell-reverse-proxy | shell-db | shell-redis
.PHONY: shell-%
shell-%:
	$(SHELL) ./scripts/enter-shell.sh $*

# Install/update all git hooks (for development, run this only once when you clone this repo)
.PHONY: install-git-hooks
install-git-hooks:
	$(SHELL) ./scripts/dev/install-git-hooks.sh

# Generate a self-signed certificate for development
.PHONY: dev-cert
dev-cert:
	$(SHELL) ./scripts/dev/cert.sh

# Generate a certificate for production
.PHONY: prod-cert
prod-cert:
	$(SHELL) ./scripts/prod/cert.sh
