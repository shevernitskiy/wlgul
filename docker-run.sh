#!/bin/bash

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at '$ENV_FILE'"
  exit 1
fi

while IFS= read -r line; do
  if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
    continue
  fi

  if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    key=$(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' <<< "$key")
    value=$(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' <<< "$value")

    if [[ "$key" == "METADATA" ]]; then
      METADATA="$value"
    elif [[ "$key" == "USERDATA" ]]; then
      USERDATA="$value"
    elif [[ "$key" == "CONTENT" ]]; then
      CONTENT="$value"
    fi
  fi
done < "$ENV_FILE"

if [[ -z "$USERDATA" || -z "$METADATA" || -z "$CONTENT" ]]; then
  echo "ERROR: USERDATA or METADATA or CONTENT is undefined."
  exit 1
fi

METADATA_ABSOLUTE=$(realpath "$METADATA")
echo "METADATA: $METADATA, absolute path: $(realpath "$METADATA")"
USERDATA_ABSOLUTE=$(realpath "$USERDATA")
echo "USERDATA: $USERDATA, absolute path: $(realpath "$USERDATA")"
CONTENT_ABSOLUTE=$(realpath "$CONTENT")
echo "CONTENT: $CONTENT, absolute path: $(realpath "$CONTENT")"


docker run -t --env-file .env \
  --mount type=bind,source="$METADATA_ABSOLUTE",target=/app/metadata.toml \
  --mount type=bind,source="$USERDATA_ABSOLUTE",target=/app/data \
  --mount type=bind,source="$CONTENT_ABSOLUTE",target=/app/content \
  wlgul . "$@"