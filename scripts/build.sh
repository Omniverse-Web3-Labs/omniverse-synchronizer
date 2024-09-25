#!/bin/bash

# 检查参数个数
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <docker_repo> <image_name>"
    exit 1
fi

DOCKER_REPO=$1
IMAGE_NAME=$2

# 构建 Docker 镜像
echo "Building Docker image: $IMAGE_NAME"
docker build -t $DOCKER_REPO/$IMAGE_NAME .

# 登录到 Docker 仓库（如果需要）
echo "Logging into Docker repository: $DOCKER_REPO"
# 这里假设您已配置好 Docker 登录
if [ -n "$DOCKER_USERNAME" ]; then
    echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin
fi

# 推送 Docker 镜像
echo "Pushing Docker image: $DOCKER_REPO/$IMAGE_NAME"
docker push $DOCKER_REPO/$IMAGE_NAME
