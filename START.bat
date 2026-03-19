@echo off
title HelpDesk Core v0.9.0
echo.
echo   =============================================
echo        HelpDesk Core v0.9.0
echo        IT Support ^& Asset Management
echo   =============================================
echo.
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [FEHLER] Node.js nicht gefunden!
    echo   Bitte installieren: https://nodejs.org/
    pause
    exit /b 1
)
echo   Node.js: & node -v
if not exist "node_modules" (
    echo.
    echo   Abhängigkeiten werden installiert...
    npm install
)
if not exist ".env.local" (
    echo.
    echo   Konfiguration wird erstellt...
    copy .env.example .env.local >nul
    echo   Bitte .env.local anpassen und dieses Script neu starten.
    notepad .env.local
    pause
    exit /b 0
)
echo.
echo   Server startet auf http://localhost:3000
echo   Zum Beenden: Ctrl+C
echo.
npm run dev
