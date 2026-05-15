@echo off
chcp 65001 >nul
echo ================================================
echo    Monitor Agent O'rnatuvchi
echo    Saidikrom - Monitor Boshqaruv Tizimi
echo ================================================
echo.

:: Python o'rnatilganmi?
python --version >nul 2>&1
if errorlevel 1 (
    echo [XATO] Python topilmadi! 
    echo Python o'rnating: https://python.org
    pause
    exit /b 1
)

echo [OK] Python topildi
echo.

:: Kutubxonalar o'rnatish
echo [1/3] Kutubxonalar o'rnatilmoqda...
pip install -r requirements.txt -q
echo [OK] Kutubxonalar tayyor
echo.

:: Monitor ID ni so'rash
echo [2/3] Sozlamalar...
set /p MONITOR_ID="Monitor raqamini kiriting (masalan: 01): "
set /p ROOM_NAME="Xona nomini kiriting (masalan: Xona 101): "
set /p SERVER_IP="Server IP manzilini kiriting (masalan: 192.168.1.100): "

:: Environment variables o'rnatish
setx MCS_MONITOR_ID "%MONITOR_ID%" /M
setx MCS_ROOM_NAME "%ROOM_NAME%" /M
setx MCS_SERVER_IP "%SERVER_IP%" /M

echo [OK] Sozlamalar saqlandi
echo.

:: Avtomatik ishga tushirish (startup)
echo [3/3] Avtomatik ishga tushirish sozlanmoqda...
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
echo @echo off > "%STARTUP_DIR%\monitor_agent.bat"
echo cd /d "%~dp0" >> "%STARTUP_DIR%\monitor_agent.bat"
echo pythonw agent.py >> "%STARTUP_DIR%\monitor_agent.bat"

echo [OK] Startup ga qo'shildi
echo.
echo ================================================
echo    O'rnatish tugadi!
echo    Kompyuterni qayta ishga tushiring.
echo ================================================
pause
echo    O'rnatish tugadi!
echo    Agent hozir ishga tushmoqda...
echo ================================================
echo.

start /min pythonw agent.py
echo Agent ishga tushdi! Endi bu oynani yopishingiz mumkin.
pause
