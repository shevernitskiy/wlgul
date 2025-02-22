#!/bin/bash

IMAGE="ghcr.io/shevernitskiy/wlgul"
CONTAINER="wlgul"

RESULT=$(docker rm $CONTAINER)

OLD_IMAGE_ID=$(docker images -q $IMAGE)
if [ ! -z "$OLD_IMAGE_ID" ]; then
  echo "removing old docker image"
  docker rmi -f $OLD_IMAGE_ID
fi

echo "pulling new docker image"
docker pull $IMAGE:latest
echo "docker image pulled"