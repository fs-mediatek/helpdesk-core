#!/bin/bash
# HelpDesk Core — Update Script
# Called by the system maintenance plugin to perform updates

LOG="/tmp/helpdesk-update.log"
exec > >(tee -a "$LOG") 2>&1

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo "[Update] $(date) — Starte Update..."

echo "[Update] Stoppe Dienst..."
sudo systemctl stop helpdesk 2>/dev/null || true
sleep 2

echo "[Update] Hole aktuellen Stand von GitHub..."
if ! git fetch origin; then
  echo "[Update] FEHLER: git fetch fehlgeschlagen"
  sudo systemctl start helpdesk
  exit 1
fi
git reset --hard origin/main

echo "[Update] Installiere Abhängigkeiten..."
npm ci --silent 2>/dev/null || npm install --silent

echo "[Update] Baue Anwendung..."
if ! npx next build; then
  echo "[Update] FEHLER: Build fehlgeschlagen — starte alten Stand neu"
  sudo systemctl start helpdesk
  exit 1
fi

echo "[Update] Starte Dienst neu..."
sudo systemctl start helpdesk

echo "[Update] Fertig! Version: $(grep '"version"' package.json | head -1)"
echo "[Update] $(date) — Update abgeschlossen."
