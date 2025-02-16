#!/bin/bash

echo "building docker image"
docker build -t ghcr.io/shevernitskiy/wlgul:latest .
echo "docker image built"