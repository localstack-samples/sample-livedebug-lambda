# default localhost env vars
export PULUMI_CONFIG_PASSPHRASE ?= sample-432
export LOCALSTACK_ENDPOINT=http://host.docker.internal:4566
export APP_NAME = sample
export APP_VERSION = 0.0.1
export API_VERSION = v1
export AWS_REGION=us-east-1

export IS_LOCAL=true
export LOGGING_LEVEL=DEBUG
export PULUMI_BACKEND_URL ?= file:///root/shared/global-iac
export AWS_ACCOUNT=000000000000
export AWS_ACCOUNT_TYPE=LOCALSTACK
export STACK_SUFFIX=local

# Pattern specific variables for each pipeline
local-%: export LOCALSTACK=1
local-tformhsl%: export STACK_DIR=iac/tformhsl


uname_m := $(shell uname -m) # store the output of the command in a variable
export LOCAL_ARCH=$(uname_m)
