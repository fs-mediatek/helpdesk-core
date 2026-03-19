# HelpDesk Core

**IT Support & Asset Management System** — Modernes, selbst gehostetes Helpdesk-System.

---

## Systemanforderungen

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **MariaDB** 10.6+ oder **MySQL** 8+ ([Download MariaDB](https://mariadb.org/download/))
- **Git** ([Download](https://git-scm.com/downloads))

---

## Installation

### Windows

**1. Voraussetzungen installieren:**
- Node.js: https://nodejs.org/ (LTS-Version, Installer ausführen)
- MariaDB: https://mariadb.org/download/ (MSI-Installer, Passwort merken)
- XAMPP geht ebenfalls (enthält MariaDB)

**2. Repository klonen und Abhängigkeiten installieren:**

```powershell
git clone https://github.com/YOUR_ORG/helpdesk-core.git
cd helpdesk-core
npm install
```

**3. Konfiguration erstellen:**

```powershell
copy .env.example .env.local
```

Dann `.env.local` öffnen und anpassen:

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=helpdesk
DB_USER=root
DB_PASSWORD=DEIN_MARIADB_PASSWORT
APP_SECRET_KEY=ein-langer-zufaelliger-text
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=HelpDesk
```

**4. Datenbank anlegen:**

In der MariaDB/MySQL Konsole oder XAMPP phpMyAdmin:

```sql
CREATE DATABASE helpdesk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Bei XAMPP mit Standardeinstellungen (root ohne Passwort) einfach `DB_PASSWORD=` leer lassen.

**5. Starten:**

```powershell
npm run dev
```

Browser öffnen: **http://localhost:3000/setup**

**6. Für Produktion (optional):**

```powershell
npm run build
npm start
```

---

### Linux (Ubuntu 22.04 / 24.04 LTS)

**Automatische Installation (als root):**

```bash
git clone https://github.com/YOUR_ORG/helpdesk-core.git
cd helpdesk-core
sudo bash install.sh
```

Der Installer installiert automatisch Node.js, MariaDB, richtet die Datenbank ein und erstellt einen Systemd-Dienst.

**Manuelle Installation:**

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# MariaDB
sudo apt-get install -y mariadb-server
sudo systemctl enable mariadb

# Datenbank
sudo mariadb -e "CREATE DATABASE helpdesk CHARACTER SET utf8mb4;"
sudo mariadb -e "CREATE USER 'helpdesk'@'localhost' IDENTIFIED BY 'PASSWORT';"
sudo mariadb -e "GRANT ALL ON helpdesk.* TO 'helpdesk'@'localhost';"

# App
cp .env.example .env.local
nano .env.local
npm install
npm run build
npm start
```

---

## Ersteinrichtung

Nach dem ersten Start: **http://localhost:3000/setup**

1. Systemprüfung (Datenbankverbindung wird getestet)
2. Firmenname eingeben
3. Admin-Account erstellen
4. Fertig — Weiterleitung zum Login

---

## Befehle

| Befehl | Beschreibung |
|---|---|
| `npm run dev` | Entwicklungsserver starten |
| `npm run build` | Produktions-Build erstellen |
| `npm start` | Produktionsserver starten |

---

## Technologie

Next.js 16 · TypeScript · Tailwind CSS v4 · MariaDB/MySQL · JWT Auth

## Lizenz

MIT
