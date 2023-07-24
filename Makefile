-include envs.makefile

BUILD_FOLDER ?= build
PROJECT_MODULE_NAME = ./src/dotnet/src/s3utillambda/

build-hot-dotnet:
	dotnet publish $(PROJECT_MODULE_NAME) \
     --self-contained false \
     -r linux-`uname -m`
	mkdir -p /tmp/hot-reload/lambdas/dotnetlambda
	cp -f $(PROJECT_MODULE_NAME)bin/Debug/net6.0/linux-`uname -m`/publish/* /tmp/hot-reload/lambdas/dotnetlambda

watch-dotnet:
	bin/watchman.sh $(PROJECT_MODULE_NAME) "make build-hot"

local-tformhcl-deploy:
	echo "Deploying with Terraform HCL"
	source venv/bin/activate && AWS_PROFILE=localstack $(TERRAFORM_CMD) -chdir=$(STACK_DIR) init
	source venv/bin/activate && AWS_PROFILE=localstack $(TERRAFORM_CMD) -chdir=$(STACK_DIR) plan
	source venv/bin/activate && AWS_PROFILE=localstack $(TERRAFORM_CMD) -chdir=$(STACK_DIR) apply

setup-venv:
	python3 -m venv venv
	source venv/bin/activate && pip install -r requirements-dev.txt


.PHONY: build-hot-dotnet watch-dotnet local-tformhcl-deploy
