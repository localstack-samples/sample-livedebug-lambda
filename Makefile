-include envs.makefile

BUILD_FOLDER ?= build
PROJECT_MODULE_NAME = ./src/dotnet/src/s3utillambda/

build-hot-dotnet:
	dotnet publish $(PROJECT_MODULE_NAME) \
     --output /tmp/hot-reload/lambdas/dotnetlambda \
     --self-contained false \
     -r linux-arm64

watch-dotnet:
	bin/watchman.sh $(PROJECT_MODULE_NAME) "make build-hot"

local-tformhcl-deploy:
	echo "Deploying with Terraform HCL"
	AWS_PROFILE=localstack terraform -chdir=iac/tformhcl init
	AWS_PROFILE=localstack terraform -chdir=iac/tformhcl plan

.PHONY: build-hot-dotnet watch-dotnet local-tformhcl-deploy
