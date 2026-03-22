#!/bin/bash
# HelpDesk Core — Update Script
# Called by the system maintenance plugin to perform updates

set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo "[Update] Stopping service..."
sudo systemctl stop helpdesk 2>/dev/null || true
sleep 2

echo "[Update] Pulling latest changes..."
git fetch origin
git reset --hard origin/main

echo "[Update] Installing dependencies..."
npm ci --silent 2>/dev/null || npm install --silent

echo "[Update] Building..."
npx next build

echo "[Update] Starting service..."
sudo systemctl start helpdesk

echo "[Update] Done! Version: $(grep '"version"' package.json | head -1)"
