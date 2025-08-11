#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Todo Calendar App"

usage() {
  cat <<'USAGE'
Setup script for Todo Calendar App

Usage:
  ./setup.sh [options]

Options:
  --start     Install dependencies and start the development server
  --build     Install dependencies and build the production bundle
  -h, --help  Show this help message

Notes:
- Uses "npm ci" when a package-lock.json is present (clean reproducible install).
- Falls back to "npm install" if no lockfile is found.
USAGE
}

START=false
BUILD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --start)
      START=true
      shift
      ;;
    --build)
      BUILD=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

# Ensure we're in the project root (package.json present)
if [[ ! -f "package.json" ]]; then
  echo "Error: package.json not found. Run this script from the project root."
  exit 1
fi

# Check prerequisites
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed or not in PATH. Install Node 16+ (18 recommended)."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or not in PATH."
  exit 1
fi

echo "======================================"
echo "  ${APP_NAME} - Environment Check"
echo "======================================"
echo "Node: $(node -v)"
echo "npm:  $(npm -v)"
echo

# Install dependencies
echo "Installing dependencies..."
if [[ -f "package-lock.json" ]]; then
  echo "package-lock.json found. Using 'npm ci' for a clean, reproducible install."
  npm ci
else
  echo "No package-lock.json found. Using 'npm install'."
  npm install
fi
echo "Dependencies installed."
echo

# Optional actions
if [[ "${START}" == "true" ]]; then
  echo "Starting development server..."
  echo "Open http://localhost:3000 in your browser."
  npm start
  # npm start is typically long-running; script will stay attached
  exit 0
fi

if [[ "${BUILD}" == "true" ]]; then
  echo "Building production bundle..."
  npm run build
  echo "Build complete. Output in ./build"
fi

echo "Setup complete. To start the dev server, run: npm start"
