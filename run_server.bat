@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === MCS v3 Server ===
if not exist package.json (
  echo [XATO] package.json topilmadi. Iltimos, loyihaga to'g'ri joydan kirganingizga ishonch hosil qiling.
  pause
  exit /b 1
)

npm.cmd install
npm.cmd start
