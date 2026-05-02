#!/usr/bin/env bash
# exit on error
set -o errexit

SERVICE=$1

if [ -z "$SERVICE" ]; then
  echo "Error: No service name provided."
  exit 1
fi

echo "--- STARTING SERVICE: $SERVICE ---"

# Navigate to the service directory and start it
# The build output is expected to be in apps/[service]/dist/main.js
cd apps/$SERVICE
node dist/main
