#!/usr/bin/env bash
# exit on error
set -o errexit

SERVICE=$1

if [ -z "$SERVICE" ]; then
  echo "Error: No service name provided."
  exit 1
fi

echo "--- BUILDING SERVICE: $SERVICE ---"

# Install all workspace dependencies
echo "Installing dependencies..."
npm install

# Build the specific service AND all its internal workspace dependencies (shared packages)
echo "Running turbo build for $SERVICE (with dependencies)..."
npx turbo run build --filter=$SERVICE...

echo "--- BUILD COMPLETE: $SERVICE ---"
