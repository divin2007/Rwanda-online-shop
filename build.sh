#!/usr/bin/env bash
# exit on error
set -o errexit

SERVICE=$1

if [ -z "$SERVICE" ]; then
  echo "Error: No service name provided."
  exit 1
fi

echo "--- BUILDING SERVICE: $SERVICE ---"

# Install dependencies at root
echo "Installing dependencies..."
npm install

# Build the specific service using turbo
echo "Running turbo build for $SERVICE..."
npx turbo run build --filter=$SERVICE

echo "--- BUILD COMPLETE: $SERVICE ---"
