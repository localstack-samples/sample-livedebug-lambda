-include envs.makefile
-include nonenv.makefile

BUILD_FOLDER ?= build
PROJECT_MODULE_NAME = ./src/dotnet/src/s3utillambda/


local-cdktf-install: cdktfinstall
# Build dotnet project, deploy to LocalStack
local-cdktf-deploy: build-hot-dotnet cdktfdeploy
local-cdktf-destroy: cdktfdestroy

# Build dotnet project, deploy to AWS
non-cdktf-deploy: build-hot-dotnet cdktfdeploy
non-cdktf-destroy: cdktfdestroy

build-hot-dotnet:
	dotnet publish $(PROJECT_MODULE_NAME) \
     --self-contained false \
     -r linux-`uname -m`
	mkdir -p /tmp/hot-reload/lambdas/dotnetlambda
	cp -f $(PROJECT_MODULE_NAME)bin/Debug/net6.0/linux-`uname -m`/publish/* /tmp/hot-reload/lambdas/dotnetlambda

watch-dotnet:
	bin/watchman.sh $(PROJECT_MODULE_NAME) "make build-hot-dotnet"

start-localstack:
	docker compose up --detach
#($(VENV_RUN); DEBUG=1 localstack start)

stop-localstack:
	docker compose down

cp-readme:
	AWS_PROFILE=localstack aws s3 cp README.md s3://sample-bucket/README.md

local-dotnet-ls-invoke:
	AWS_PROFILE=localstack aws lambda invoke --function-name livedebug-lambda \
--cli-binary-format raw-in-base64-out \
--payload '{"arg":"Working with LocalStack is Fun"}' output.txt


cdktfdeploy:
	cd $(STACK_DIR) && cdktf deploy $(TFSTACK_NAME)

cdktfdestroy:
	cd $(STACK_DIR) && cdktf destroy $(TFSTACK_NAME)

cdktfinstall:
	cd $(STACK_DIR) && npm install

non-cp-readme:
	aws s3 cp README.md s3://$(LIST_BUCKET_NAME)/README.md

non-empty-bucket:
	aws s3 rm s3://$(LIST_BUCKET_NAME) --recursive

non-dotnet-invoke:
	aws lambda invoke --function-name livedebug-lambda \
--cli-binary-format raw-in-base64-out \
--payload '{"arg":"Working with LocalStack is Fun"}' output.txt

non-dotnet-ls-invoke:
	aws lambda invoke --function-name livedebug-lambda \
--cli-binary-format raw-in-base64-out \
--payload '{"arg":"Working with LocalStack is Fun"}' output.txt







local-tformhcl-deploy:
	echo "Deploying with Terraform HCL"
	$(VENV_RUN); AWS_PROFILE=localstack $(TERRAFORM_CMD) -chdir=$(STACK_DIR) init
	$(VENV_RUN); AWS_PROFILE=localstack $(TERRAFORM_CMD) -chdir=$(STACK_DIR) plan
	$(VENV_RUN); AWS_PROFILE=localstack $(TERRAFORM_CMD) -chdir=$(STACK_DIR) apply

.PHONY: build-hot-dotnet watch-dotnet local-tformhcl-deploy cp-readme local-dotnet-deploy local-dotnet-invoke
