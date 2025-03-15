ENVS := dev prod
SERVICES := api-server frontend reverse-proxy postgres redis

# build-dev | build-prod
.PHONY: build-%
build-%:
	@if ! echo "$(ENVS)" | grep -w "$*" > /dev/null; then \
		echo "Error: '$*' is not a valid environment. Must be one of: $(ENVS)"; \
		exit 1; \
	fi
	$(SHELL) ./scripts/$*/build.sh

# start-dev | start-prod
.PHONY: start-%
start-%:
	@if ! echo "$(ENVS)" | grep -w "$*" > /dev/null; then \
		echo "Error: '$*' is not a valid environment. Must be one of: $(ENVS)"; \
		exit 1; \
	fi
	$(SHELL) ./scripts/$*/start.sh

# stop-dev | stop-prod
.PHONY: stop-%
stop-%:
	@if ! echo "$(ENVS)" | grep -w "$*" > /dev/null; then \
		echo "Error: '$*' is not a valid environment. Must be one of: $(ENVS)"; \
		exit 1; \
	fi
	$(SHELL) ./scripts/$*/stop.sh

.PHONY: start-dev
start-dev:
	$(SHELL) ./scripts/dev/start.sh

.PHONY: stop-dev
stop-dev:
	$(SHELL) ./scripts/dev/stop.sh

# Install/update all git hooks (for development, run this only once when you clone this repo)
.PHONY: install-git-hooks
install-git-hooks:
	$(SHELL) ./scripts/dev/installgithooks.sh

# Push code to remote master branch (for development)
.PHONY: push-to-remote-master
push-to-remote-master:
	$(SHELL) ./scripts/dev/pushtoremotemaster.sh

# Run pytest (for development)
.PHONY: run-pytest
run-pytest:
	$(SHELL) ./scripts/dev/runpytest.sh

# Pull code from remote master branch and deploy (for production)
.PHONY: pull-master-and-deploy
pull-master-and-deploy:
	$(SHELL) ./scripts/prod/pullmasteranddeploy.sh

# Reboot the server (for production)
.PHONY: reboot
reboot:
	$(SHELL) ./scripts/prod/reboot.sh
