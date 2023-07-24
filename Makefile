BUILD_FOLDER ?= build
PROJECT_MODULE_NAME = ./src/dotnet/src/s3utillambda/

build-hot-dotnet:
	dotnet publish $(PROJECT_MODULE_NAME) \
     --output /tmp/hot-reload/lambdas/dotnetlambda \
     --self-contained false \
     -r linux-arm64

watch-dotnet:
	bin/watchman.sh $(PROJECT_MODULE_NAME) "make build-hot"

.PHONY: build-hot-dotnet watch-dotnet
