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
	bin/watchman.sh $(PROJECT_MODULE_NAME) "make build-hot-dotnet"

local-tformhcl-deploy:
	echo "Deploying with Terraform HCL"
	source venv/bin/activate && AWS_PROFILE=localstack $(TERRAFORM_CMD) -chdir=$(STACK_DIR) init
	source venv/bin/activate && AWS_PROFILE=localstack $(TERRAFORM_CMD) -chdir=$(STACK_DIR) plan
	source venv/bin/activate && AWS_PROFILE=localstack $(TERRAFORM_CMD) -chdir=$(STACK_DIR) apply

setup-venv:
	python3 -m venv venv
	source venv/bin/activate && pip install -r requirements-dev.txt

cp-readme:
	source venv/bin/activate && awslocal s3 cp README.md s3://sample-bucket/README.md

local-dotnet-deploy:
	awslocal lambda create-function --function-name dotnetfunction \
	--code S3Bucket="hot-reload",S3Key="/tmp/hot-reload/lambdas/dotnetlambda" \
	--handler s3utillambda::s3utillambda.Function::FunctionHandler \
	--runtime dotnet6 \
	--timeout 15 \
	--environment "Variables={BUCKET=sample-bucket,IS_IDE_DEV=1}" \
	--architecture `uname -m` \
	--role arn:aws:iam::000000000000:role/lambda-role

local-dotnet-invoke:
	awslocal lambda invoke --function-name dotnetfunction \
--cli-binary-format raw-in-base64-out \
--payload '{"arg":"Working with LocalStack is Fun"}' output.txt


.PHONY: build-hot-dotnet watch-dotnet local-tformhcl-deploy cp-readme local-dotnet-deploy local-dotnet-invoke
