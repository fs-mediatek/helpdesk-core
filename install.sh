#!/bin/bash
set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m"

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_NAME="helpdesk"
DB_USER="helpdesk"
DB_PASS="helpdesk_db_pass"
APP_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 40)
APP_PORT=3000

echo -e "${BOLD}${BLUE}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║     HelpDesk Core — Installer            ║"
echo "  ║     IT Support & Asset Management        ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

[ "$EUID" -ne 0 ] && echo -e "${RED}Bitte als root: sudo bash install.sh${NC}" && exit 1

# 1. System
echo -e "${GREEN}[1/7]${NC} Systemaktualisierung..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
apt-get install -y -qq curl git openssl

# 2. Node.js
echo -e "${GREEN}[2/7]${NC} Node.js 22 installieren..."
if ! command -v node &>/dev/null || [ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
echo "  → Node $(node -v), npm $(npm -v)"

# 3. MySQL
echo -e "${GREEN}[3/7]${NC} MySQL installieren..."
if ! command -v mysql &>/dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mysql-server
  systemctl enable mysql
fi
systemctl start mysql 2>/dev/null || true
sleep 2

# 4. Datenbank
echo -e "${GREEN}[4/7]${NC} Datenbank einrichten..."
mysql -u root -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
mysql -u root -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" 2>/dev/null
mysql -u root -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;" 2>/dev/null
echo "  → Datenbank OK"

# 5. App installieren
echo -e "${GREEN}[5/7]${NC} Anwendung installieren..."
cd $APP_DIR

SERVER_IP=$(hostname -I | awk '{print $1}')

cat > .env.local <<EOF
DB_HOST=localhost
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_SOCKET=
APP_SECRET_KEY=${APP_SECRET}
APP_URL=http://${SERVER_IP}:${APP_PORT}
NEXT_PUBLIC_APP_NAME=HelpDesk
EOF

npm ci --silent 2>/dev/null || npm install --silent
echo "  → Abhängigkeiten installiert"

echo "  → Build läuft..."
npx next build > /tmp/helpdesk-build.log 2>&1
echo "  → Build OK"

# 6. Tabellen + Admin-User
echo -e "${GREEN}[6/7]${NC} Datenbank-Tabellen und Admin-User..."

mysql -u ${DB_USER} -p"${DB_PASS}" ${DB_NAME} << 'SQLEOF'
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(200) DEFAULT 'user',
  department VARCHAR(100) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(100) NOT NULL UNIQUE,
  value TEXT
);
CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) DEFAULT NULL,
  color VARCHAR(150) DEFAULT NULL,
  is_builtin TINYINT(1) DEFAULT 0,
  sort_order INT DEFAULT 100
);
CREATE TABLE IF NOT EXISTS departments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(150) DEFAULT NULL,
  parent_id INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tickets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_number VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('open','pending','in_progress','resolved','closed') DEFAULT 'open',
  priority ENUM('low','medium','high','critical') DEFAULT 'medium',
  category VARCHAR(100) DEFAULT NULL,
  requester_id INT UNSIGNED,
  assignee_id INT UNSIGNED DEFAULT NULL,
  sla_due_at TIMESTAMP NULL DEFAULT NULL,
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  zammad_id INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ticket_counters (
  year INT PRIMARY KEY,
  last_number INT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ticket_comments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NULL,
  content TEXT NOT NULL,
  is_internal TINYINT(1) DEFAULT 0,
  is_system TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ticket_checklist (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT UNSIGNED NOT NULL,
  content VARCHAR(500) NOT NULL,
  is_done TINYINT(1) DEFAULT 0,
  done_by VARCHAR(100) DEFAULT NULL,
  done_at TIMESTAMP NULL DEFAULT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket (ticket_id)
);
CREATE TABLE IF NOT EXISTS assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset_tag VARCHAR(50) UNIQUE,
  name VARCHAR(255) DEFAULT NULL,
  type VARCHAR(50) DEFAULT NULL,
  brand VARCHAR(100) DEFAULT NULL,
  model VARCHAR(100) DEFAULT NULL,
  serial_number VARCHAR(100) DEFAULT NULL,
  status ENUM('available','assigned','maintenance','retired') DEFAULT 'available',
  assigned_to_user_id INT DEFAULT NULL,
  purchase_date DATE DEFAULT NULL,
  warranty_until DATE DEFAULT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  platform VARCHAR(20) NOT NULL DEFAULT 'other',
  active TINYINT(1) NOT NULL DEFAULT 1,
  manufacturer VARCHAR(100) DEFAULT NULL,
  purchase_price DECIMAL(10,2) DEFAULT NULL,
  commissioned_at DATE DEFAULT NULL,
  primary_user_email VARCHAR(255) DEFAULT NULL,
  os_version VARCHAR(100) DEFAULT NULL,
  intune_device_id VARCHAR(100) DEFAULT NULL,
  phone_number VARCHAR(30) DEFAULT NULL,
  imei VARCHAR(20) DEFAULT NULL,
  friendly_name VARCHAR(255) DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'new',
  priority VARCHAR(20) DEFAULT 'medium',
  category VARCHAR(100) DEFAULT NULL,
  requester_id INT UNSIGNED,
  assignee_id INT UNSIGNED DEFAULT NULL,
  workflow_data JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  quantity INT DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT NULL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS order_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  workflow JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inventory (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  sku VARCHAR(50) DEFAULT NULL,
  category VARCHAR(100) DEFAULT NULL,
  quantity INT DEFAULT 0,
  min_quantity INT DEFAULT 0,
  location VARCHAR(100) DEFAULT NULL,
  supplier_id INT UNSIGNED DEFAULT NULL,
  unit_price DECIMAL(10,2) DEFAULT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS suppliers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_name VARCHAR(100) DEFAULT NULL,
  contact_email VARCHAR(200) DEFAULT NULL,
  contact_phone VARCHAR(50) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS locations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL UNIQUE,
  address VARCHAR(255) DEFAULT NULL,
  contact_name VARCHAR(100) DEFAULT NULL,
  contact_phone VARCHAR(50) DEFAULT NULL,
  contact_email VARCHAR(200) DEFAULT NULL,
  notes TEXT,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS kb_articles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  content_html LONGTEXT,
  status ENUM('draft','published') DEFAULT 'draft',
  tags VARCHAR(500) DEFAULT '',
  author_id INT UNSIGNED,
  views INT DEFAULT 0,
  helpful_votes INT DEFAULT 0,
  unhelpful_votes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sla_rules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(100) DEFAULT NULL,
  department VARCHAR(100) DEFAULT NULL,
  priority VARCHAR(20) DEFAULT NULL,
  response_hours INT DEFAULT NULL,
  resolve_hours INT DEFAULT NULL,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS catalog (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT NULL,
  price DECIMAL(10,2) DEFAULT NULL,
  image_url VARCHAR(500) DEFAULT NULL,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS templates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) DEFAULT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS workflows (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  steps JSON DEFAULT NULL,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  is_read TINYINT(1) DEFAULT 0,
  link VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS chatbot_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(50) NOT NULL UNIQUE,
  config_value TEXT
);
CREATE TABLE IF NOT EXISTS chatbot_responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  keywords VARCHAR(500) NOT NULL,
  title VARCHAR(200) NOT NULL,
  answer TEXT NOT NULL,
  link VARCHAR(500) DEFAULT NULL,
  sort_order INT DEFAULT 0,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS chatbot_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  search_term VARCHAR(500) NOT NULL,
  has_results TINYINT(1) DEFAULT 0,
  matched_articles VARCHAR(500) DEFAULT '',
  matched_responses VARCHAR(500) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
SQLEOF
echo "  → Tabellen erstellt"

# Admin user
cd $APP_DIR
node -e "
const bcrypt=require('bcryptjs'),mysql=require('mysql2/promise');
(async()=>{
  const p=mysql.createPool({host:'localhost',port:3306,user:'${DB_USER}',password:'${DB_PASS}',database:'${DB_NAME}'});
  const[r]=await p.execute('SELECT COUNT(*)as c FROM users');
  if(r[0].c===0){const h=await bcrypt.hash('admin',10);await p.execute('INSERT INTO users(name,email,password_hash,role)VALUES(?,?,?,?)',['Administrator','admin@helpdesk.local',h,'admin']);console.log('  → Admin erstellt: admin@helpdesk.local / admin')}
  else console.log('  → Admin existiert bereits');
  await p.end()
})().catch(e=>console.error('  → Fehler:',e.message));
"

# 7. Systemdienst
echo -e "${GREEN}[7/7]${NC} Systemdienst einrichten..."

cat > /etc/systemd/system/helpdesk.service <<EOF
[Unit]
Description=HelpDesk Core Application
After=network.target mysql.service
Wants=mysql.service
[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/npx next start -p ${APP_PORT} -H 0.0.0.0
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable helpdesk
systemctl restart helpdesk
sleep 3

SERVER_IP=$(hostname -I | awk '{print $1}')
systemctl is-active --quiet helpdesk && SVC="${GREEN}läuft${NC}" || SVC="${RED}Fehler${NC}"

echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Installation abgeschlossen!${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Dienst:${NC}  ${SVC}"
echo -e "  ${BOLD}URL:${NC}     http://${SERVER_IP}:${APP_PORT}"
echo -e "  ${BOLD}Login:${NC}   admin@helpdesk.local / admin"
echo -e "  ${RED}         Passwort nach Login ändern!${NC}"
echo ""
