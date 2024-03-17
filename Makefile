.PHONY: push-to-remote-master
push-to-remote-master:
	$(SHELL) ./scripts/dev/pushtoremotemaster.sh

.PHONY: run-pytest
run-pytest:
	$(SHELL) ./scripts/dev/runpytest.sh

.PHONY: pull-master-and-deploy
pull-master-and-deploy:
	$(SHELL) ./scripts/prod/pullmasteranddeploy.sh
