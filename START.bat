@echo off
title HelpDesk Next
cd /d "%~dp0"

:loop
echo [HelpDesk] Server startet...
npm run dev
echo [HelpDesk] Server gestoppt. Neustart in 2 Sekunden...
timeout /t 2 /nobreak >nul
goto loop
