#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────────────────────
#  HelpDesk Core — Automated Installer for Ubuntu 22.04 / 24.04 LTS
# ─────────────────────────────────────────────────────────────────────────────

BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m"

APP_DIR="/opt/helpdesk"
DB_NAME="helpdesk"
DB_USER="root"
DB_PASS=""
APP_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 40)
NODE_VERSION="20"
APP_PORT=3000

echo -e "${BOLD}${BLUE}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║       HelpDesk Core — Installer          ║"
echo "  ║       IT Support & Asset Management      ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Check root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Bitte als root ausführen: sudo bash install.sh${NC}"
  exit 1
fi

# Check Ubuntu
if ! grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
  echo -e "${YELLOW}Warnung: Dieses Script ist für Ubuntu LTS optimiert.${NC}"
fi

# ── Step 1: System ──
echo -e "${GREEN}[1/6]${NC} Systemaktualisierung..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

# ── Step 2: Node.js ──
echo -e "${GREEN}[2/6]${NC} Node.js $NODE_VERSION installieren..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs
fi
echo "  → Node $(node -v), npm $(npm -v)"

# ── Step 3: MariaDB ──
echo -e "${GREEN}[3/6]${NC} MariaDB installieren..."
if ! command -v mariadb &>/dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mariadb-server mariadb-client
  systemctl enable mariadb
  systemctl start mariadb
fi
# Make sure MariaDB is running
systemctl start mariadb 2>/dev/null || true
sleep 2

# ── Step 4: Database ──
echo -e "${GREEN}[4/6]${NC} Datenbank einrichten..."
# Use root without password (default MariaDB on Ubuntu) — simplest, most reliable
mariadb -u root <<EOSQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOSQL
echo "  → Datenbank: ${DB_NAME} (Benutzer: root, kein Passwort)"

# Verify connection works
if ! mariadb -u root -e "SELECT 1" ${DB_NAME} &>/dev/null; then
  echo -e "${RED}  Datenbankverbindung fehlgeschlagen! Bitte manuell prüfen.${NC}"
  exit 1
fi
echo "  → Verbindung geprüft: OK"

# ── Step 5: Application ──
echo -e "${GREEN}[5/6]${NC} Anwendung installieren..."
INSTALL_DIR=$(pwd)

# Copy to /opt/helpdesk if not already there
if [ "$INSTALL_DIR" != "$APP_DIR" ]; then
  mkdir -p $APP_DIR
  cp -r . $APP_DIR/
fi
cd $APP_DIR

# Create .env.local
SERVER_IP=$(hostname -I | awk '{print $1}')
cat > .env.local <<EOF
DB_HOST=localhost
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
APP_SECRET_KEY=${APP_SECRET}
APP_URL=http://${SERVER_IP}:${APP_PORT}
NEXT_PUBLIC_APP_NAME=HelpDesk
EOF

echo "  → .env.local erstellt"

# Install dependencies
npm ci --production=false --silent 2>/dev/null || npm install --silent
echo "  → Abhängigkeiten installiert"

# Production build
echo "  → Anwendung wird gebaut (kann 1-2 Min. dauern)..."
npx next build > /tmp/helpdesk-build.log 2>&1
if [ $? -eq 0 ]; then
  APP_MODE="start"
  echo "  → Build erfolgreich (Produktionsmodus)"
else
  APP_MODE="dev"
  echo -e "${YELLOW}  → Build fehlgeschlagen, verwende Entwicklungsmodus${NC}"
fi

# Set permissions — current user owns everything
chmod -R 755 $APP_DIR
chown -R root:root $APP_DIR

# ── Step 6: Systemd Service ──
echo -e "${GREEN}[6/6]${NC} Systemdienst einrichten..."

NODE_PATH=$(which node)
NPX_PATH=$(which npx)

cat > /etc/systemd/system/helpdesk.service <<EOF
[Unit]
Description=HelpDesk Core
After=network.target mariadb.service
Wants=mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
ExecStart=${NPX_PATH} next ${APP_MODE} -p ${APP_PORT} -H 0.0.0.0
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[Install]
WantedBy=multi-user.target
EOF

# Open firewall
if command -v ufw &>/dev/null; then
  ufw allow ${APP_PORT}/tcp 2>/dev/null || true
fi

systemctl daemon-reload
systemctl enable helpdesk
systemctl start helpdesk

# Wait and verify
sleep 3
if systemctl is-active --quiet helpdesk; then
  SERVICE_STATUS="${GREEN}läuft${NC}"
else
  SERVICE_STATUS="${RED}Fehler — prüfe: journalctl -u helpdesk -f${NC}"
fi

echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Installation erfolgreich abgeschlossen!${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Dienst:${NC}         ${SERVICE_STATUS}"
echo -e "  ${BOLD}Zugriff:${NC}        http://${SERVER_IP}:${APP_PORT}"
echo -e "  ${BOLD}Ersteinrichtung:${NC} http://${SERVER_IP}:${APP_PORT}/setup"
echo ""
echo -e "  ${BOLD}Dienstverwaltung:${NC}"
echo -e "    systemctl status helpdesk"
echo -e "    systemctl restart helpdesk"
echo -e "    journalctl -u helpdesk -f"
echo ""
# Create default admin user
echo ""
echo -e "  ${BOLD}Standard-Admin wird angelegt...${NC}"
cd $APP_DIR
node -e "
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host:'localhost', user:'root', password:'', database:'${DB_NAME}' });
  await pool.execute(\`CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(200) DEFAULT 'user',
    department VARCHAR(100) DEFAULT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )\`);
  await pool.execute(\`CREATE TABLE IF NOT EXISTS settings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(100) NOT NULL UNIQUE,
    value TEXT
  )\`);
  const [existing] = await pool.execute('SELECT COUNT(*) as c FROM users');
  if (existing[0].c === 0) {
    const hash = await bcrypt.hash('admin', 10);
    await pool.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', ['Administrator', 'admin@helpdesk.local', hash, 'admin']);
    console.log('  → Admin erstellt');
  } else {
    console.log('  → Admin existiert bereits');
  }
  await pool.end();
})().catch(e => console.error('  → Fehler:', e.message));
" 2>&1

echo ""
echo -e "  ${BOLD}Standard-Zugangsdaten:${NC}"
echo -e "    E-Mail:   ${YELLOW}admin@helpdesk.local${NC}"
echo -e "    Passwort: ${YELLOW}admin${NC}"
echo -e "    ${RED}Bitte nach dem ersten Login ändern!${NC}"
echo ""
echo -e "  ${BOLD}Datenbank:${NC} ${DB_NAME} (root@localhost, kein Passwort)"
echo ""
