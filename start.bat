@echo off
echo === MCS v3 Server ===
cd /d "%~dp0"
npm install
node server.js
pause
