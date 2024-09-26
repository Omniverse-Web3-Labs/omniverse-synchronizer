#!/bin/bash

# check parameters
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <docker_repo> <image_name>"
    exit 1
fi

DOCKER_REPO=$1
IMAGE_NAME=$2

# build Docker image
echo "Building Docker image: $IMAGE_NAME"
docker build -t $DOCKER_REPO/$IMAGE_NAME .

# login Docker repo（if neccessary）
echo "Logging into Docker repository: $DOCKER_REPO"
if [ -n "$DOCKER_USERNAME" ]; then
    echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin
fi

# push Docker image
echo "Pushing Docker image: $DOCKER_REPO/$IMAGE_NAME"
docker push $DOCKER_REPO/$IMAGE_NAME
