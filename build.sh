#!/usr/bin/env bash
# exit on error
set -o errexit

SERVICE=$1

if [ -z "$SERVICE" ]; then
  echo "Error: No service name provided."
  exit 1
fi

echo "--- BUILDING SERVICE: $SERVICE ---"

# Install all workspace dependencies. Prefer npm ci on Render so deploys use
# the committed lockfile instead of drifting dependency resolution.
echo "Installing dependencies..."
if [ -f package-lock.json ]; then
  npm ci --include=dev
else
  npm install
fi

# Render deploys each service independently. Build shared workspace packages
# explicitly first so packages with "main": "dist/index.js" are always present,
# even if Turbo's filtered graph misses an internal dependency.
echo "Building shared workspace packages..."
npm run build --workspace @rmf/shared-types
npm run build --workspace @rmf/shared-utils
npm run build --workspace @rmf/location
npm run build --workspace @rmf/health-check
npm run build --workspace @rmf/database
npm run build --workspace @rmf/auth

# Build the specific service AND all its internal workspace dependencies.
echo "Running turbo build for $SERVICE (with dependencies)..."
npx turbo run build --filter=$SERVICE...

echo "--- BUILD COMPLETE: $SERVICE ---"
