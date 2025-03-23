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

# api-server-shell | frontend-shell | reverse-proxy-shell | db-shell | redis-shell
.PHONY: %-shell
%-shell:
	$(SHELL) ./scripts/enter-shell.sh $*

# Install/update all git hooks (for development, run this only once when you clone this repo)
.PHONY: install-git-hooks
install-git-hooks:
	$(SHELL) ./scripts/dev/install-git-hooks.sh

# Generate a self-signed certificate for development
.PHONY: cert
cert:
	$(SHELL) ./scripts/dev/cert.sh
