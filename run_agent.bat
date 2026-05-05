@echo off
chcp 65001 >nul
cd /d "%~dp0"

if "%1"=="" goto usage
set MCS_SERVER_IP=%1
set MCS_SERVER_PORT=%2
if "%MCS_SERVER_PORT%"=="" set MCS_SERVER_PORT=3000
set MCS_MONITOR_ID=%3
if "%MCS_MONITOR_ID%"=="" set MCS_MONITOR_ID=01
set MCS_ROOM_NAME=%4
if "%MCS_ROOM_NAME%"=="" set MCS_ROOM_NAME=Room

echo === Agentni ishga tushurish ===
echo Server IP: %MCS_SERVER_IP%
echo Port: %MCS_SERVER_PORT%
echo Monitor ID: %MCS_MONITOR_ID%
echo Xona: %MCS_ROOM_NAME%

echo.
python agent.py

goto end

:usage
echo Foydalanish: run_agent.bat ^<SERVER_IP^> [PORT] [MONITOR_ID] [ROOM_NAME]
echo Masalan: run_agent.bat 10.77.50.126 3000 02 "Xona 102"

goto end

:end
