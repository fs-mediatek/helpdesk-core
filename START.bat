@echo off
title HelpDesk Core
echo.
echo   =============================================
echo        HelpDesk Core - IT Support System
echo   =============================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [FEHLER] Node.js nicht gefunden!
    echo   Bitte installieren: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo   Node.js:
node -v
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo   Abhängigkeiten werden installiert...
    echo   Dies kann einige Minuten dauern.
    echo.
    npm install
    echo.
)

:: Check .env.local
if not exist ".env.local" (
    echo   Konfiguration wird erstellt...
    copy .env.example .env.local >nul
    echo   [INFO] Bitte .env.local anpassen (Datenbank-Zugangsdaten)
    echo.
    notepad .env.local
    pause
)

echo   Server startet...
echo   Browser oeffnen: http://localhost:3000/setup
echo.
echo   Zum Beenden: Ctrl+C
echo.

npm run dev
