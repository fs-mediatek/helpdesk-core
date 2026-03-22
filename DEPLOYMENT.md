# HelpDesk Core — Deployment-Dokumentation

> Deployment auf Proxmox VM mit Ubuntu 24.04.4 LTS

---

## Übersicht

| Parameter | Wert |
|---|---|
| **OS** | Ubuntu 24.04.4 LTS (Noble Numbat) |
| **CPU** | min. 2 Kerne |
| **RAM** | min. 4 GB |
| **Disk** | min. 30 GB |
| **App-Port** | 3000 |

---

## 1. VM erstellen (Proxmox)

### 1.1 Ubuntu Cloud-Image herunterladen

Im Proxmox-Webinterface unter **local** > **ISO Images** > **Download from URL**:

```
URL: https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-amd64.img
```

### 1.2 VM erstellen

```bash
# VM erstellen (VMID und Name anpassen)
qm create VMID --name helpdesk --cores 2 --memory 4096 --ostype l26 \
  --scsihw virtio-scsi-single --agent 1

# Cloud-Image als Disk importieren
qm importdisk VMID /var/lib/vz/template/iso/ubuntu-24.04-cloudimg-amd64.img local-lvm

# Disk zuweisen und vergrößern
qm set VMID --scsi0 local-lvm:vm-VMID-disk-0,discard=on,ssd=1
qm resize VMID scsi0 30G

# Cloud-Init Drive hinzufügen
qm set VMID --ide2 local-lvm:cloudinit

# Boot-Reihenfolge, Netzwerk, VGA
qm set VMID --boot order=scsi0
qm set VMID --net0 virtio,bridge=vmbr0
qm set VMID --vga std
```

### 1.3 Cloud-Init konfigurieren

```bash
qm set VMID --ciuser helpdesk
qm set VMID --cipassword SICHERES_PASSWORT
qm set VMID --ipconfig0 ip=IP_ADRESSE/24,gw=GATEWAY_IP
qm set VMID --nameserver 8.8.8.8
```

**Passwort-Auth für SSH aktivieren** (Cloud-Init Snippet):

```bash
mkdir -p /var/lib/vz/snippets

cat > /var/lib/vz/snippets/helpdesk-cloud-init.yaml << 'EOF'
#cloud-config
ssh_pwauth: true
chpasswd:
  expire: false
  users:
    - name: helpdesk
      password: SICHERES_PASSWORT
      type: text
EOF

qm set VMID --cicustom "user=local:snippets/helpdesk-cloud-init.yaml"
```

### 1.4 VM starten

```bash
qm start VMID
```

---

## 2. Server einrichten (auf der VM per SSH)

```bash
ssh helpdesk@IP_ADRESSE
```

### 2.1 System aktualisieren

```bash
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
```

### 2.2 Node.js 22 LTS installieren

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs
```

### 2.3 MySQL 8 installieren

```bash
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
```

### 2.4 Git installieren

```bash
sudo apt-get install -y git
```

---

## 3. Datenbank einrichten

```bash
sudo mysql -e "
CREATE DATABASE IF NOT EXISTS helpdesk
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'helpdesk'@'localhost'
  IDENTIFIED BY 'SICHERES_DB_PASSWORT';

GRANT ALL PRIVILEGES ON helpdesk.*
  TO 'helpdesk'@'localhost';

FLUSH PRIVILEGES;
"
```

---

## 4. Helpdesk-App deployen

### 4.1 Repository klonen

```bash
cd ~
git clone https://github.com/DEIN_USER/helpdesk-core.git helpdesk-app
cd helpdesk-app
```

### 4.2 Umgebungsvariablen konfigurieren

```bash
APP_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 40)

cat > .env.local << EOF
DB_HOST=localhost
DB_PORT=3306
DB_NAME=helpdesk
DB_USER=helpdesk
DB_PASSWORD=SICHERES_DB_PASSWORT
DB_SOCKET=
APP_SECRET_KEY=${APP_SECRET}
APP_URL=http://IP_ADRESSE:3000
NEXT_PUBLIC_APP_NAME=HelpDesk
EOF
```

### 4.3 Abhängigkeiten installieren & bauen

```bash
npm ci
npx next build
```

### 4.4 Teststart (manuell)

```bash
npx next start -p 3000 -H 0.0.0.0
# → Strg+C zum Beenden
```

---

## 5. Systemdienst einrichten

### 5.1 Service-Datei erstellen

```bash
sudo tee /etc/systemd/system/helpdesk.service << 'EOF'
[Unit]
Description=HelpDesk Core Application
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=helpdesk
Group=helpdesk
WorkingDirectory=/home/helpdesk/helpdesk-app
ExecStart=/usr/bin/npx next start -p 3000 -H 0.0.0.0
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[Install]
WantedBy=multi-user.target
EOF
```

### 5.2 Service aktivieren & starten

```bash
sudo systemctl daemon-reload
sudo systemctl enable helpdesk
sudo systemctl start helpdesk
```

### 5.3 Status prüfen

```bash
sudo systemctl status helpdesk
journalctl -u helpdesk -f
```

---

## 6. Ersteinrichtung

1. Browser öffnen: **http://IP_ADRESSE:3000**
2. Beim ersten Aufruf werden alle Tabellen automatisch erstellt
3. Standard-Login: `admin@helpdesk.local` / `admin`
4. **Passwort nach dem ersten Login ändern!**

---

## 7. Wartung

### App aktualisieren

```bash
cd ~/helpdesk-app
git pull origin main
npm ci
npx next build
sudo systemctl restart helpdesk
```

### Service-Befehle

```bash
sudo systemctl status helpdesk    # Status prüfen
sudo systemctl restart helpdesk   # Neustart
sudo systemctl stop helpdesk      # Stoppen
journalctl -u helpdesk -f         # Live-Logs
```

### Datenbank-Backup

```bash
mysqldump -u helpdesk -p'DB_PASSWORT' helpdesk > ~/backup_$(date +%Y%m%d).sql
```

### Datenbank-Restore

```bash
mysql -u helpdesk -p'DB_PASSWORT' helpdesk < ~/backup_YYYYMMDD.sql
```

---

## Technische Details

| Komponente | Version |
|---|---|
| Ubuntu | 24.04.4 LTS |
| Node.js | 22.x LTS |
| MySQL | 8.x |
| Next.js | 16.x |
| React | 19.x |
