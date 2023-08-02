VENV_BIN ?= python3 -m venv
VENV_DIR ?= .venv
PIP_CMD ?= pip3
ifeq ($(OS), Windows_NT)
	VENV_ACTIVATE = $(VENV_DIR)/Scripts/activate
else
	VENV_ACTIVATE = $(VENV_DIR)/bin/activate
endif

VENV_RUN = . $(VENV_ACTIVATE)
$(VENV_ACTIVATE):
	test -d $(VENV_DIR) || $(VENV_BIN) $(VENV_DIR)
	$(VENV_RUN); $(PIP_CMD) install --upgrade pip setuptools wheel twine
	$(VENV_RUN); $(PIP_CMD) install $(PIP_OPTS) -r requirements.txt
	touch $(VENV_ACTIVATE)

venv: $(VENV_ACTIVATE)    ## Create a new (empty) virtual environment

freeze:                   ## Run pip freeze -l in the virtual environment
	@$(VENV_RUN); pip freeze -l


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
export TERRAFORM_CMD=terraform

# Pattern specific variables for each pipeline
local-%: export LOCALSTACK=1
local-%: export TERRAFORM_CMD=tflocal
local-tformhcl%: export STACK_DIR=iac/terraform/hcl


uname_m := $(shell uname -m) # store the output of the command in a variable
export LOCAL_ARCH=$(uname_m)
