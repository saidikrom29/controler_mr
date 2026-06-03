#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Monitor Agent — har bir kompyuterga o'rnatiladigan dastur
Windows 10/11 da ishlaydi
"""

import asyncio
import websockets
import json
import subprocess
import platform
import socket
import base64
import os
import ctypes
from datetime import datetime

# =============================================
# SOZLAMALAR — .env yoki muhit o'zgaruvchilari orqali ham berish mumkin
# =============================================
IS_WINDOWS = platform.system() == "Windows"

def log(msg):
    """Vaqt tamg'asi bilan xabar chiqarish."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

SERVER_IP   = os.getenv("MCS_SERVER_IP", "127.0.0.1")   # Server kompyuter IP si
SERVER_PORT = int(os.getenv("MCS_SERVER_PORT", "3000"))
MONITOR_ID  = os.getenv("MCS_MONITOR_ID", "01")         # Har bir kompyuterda boshqa raqam: "01", "02" ...
ROOM_NAME   = os.getenv("MCS_ROOM_NAME", "Xona 101")    # Xona nomi
# =============================================

SERVER_URL = f"ws://{SERVER_IP}:{SERVER_PORT}"


def get_local_ip():
    """Lokal IPv4 manzilni aniqlashga harakat qiladi."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except socket.gaierror:
            return "127.0.0.1"
    finally:
        sock.close()

def get_system_info():
    return {
        "os": platform.system() + " " + platform.release(),
        "hostname": socket.gethostname(),
        "room": ROOM_NAME,
        "monitorId": MONITOR_ID,
        "ip": get_local_ip()
    }

def turn_off_monitor():
    """Monitorni o'chirish (sleep rejim)"""
    if IS_WINDOWS:
        ctypes.windll.user32.SendMessageW(0xFFFF, 0x0112, 0xF170, 2)
    log("Monitor o'chirildi")

def turn_on_monitor():
    """Monitorni yoqish"""
    if IS_WINDOWS:
        ctypes.windll.user32.SendMessageW(0xFFFF, 0x0112, 0xF170, -1)
    log("Monitor yoqildi")

def sleep_monitor():
    """Sleep rejim"""
    if IS_WINDOWS:
        subprocess.run(["powercfg", "/change", "monitor-timeout-ac", "1"], 
                      capture_output=True)
        ctypes.windll.user32.SendMessageW(0xFFFF, 0x0112, 0xF170, 2)
    log("Sleep rejimga o'tildi")

def restart_pc():
    """Kompyuterni qayta ishga tushirish"""
    if IS_WINDOWS:
        subprocess.run(["shutdown", "/r", "/t", "5"])
    log("Qayta ishga tushirilmoqda...")

def shutdown_pc():
    """Kompyuterni o'chirish"""
    if IS_WINDOWS:
        subprocess.run(["shutdown", "/s", "/t", "5"])
    log("O'chirilmoqda...")

def lock_pc():
    """Kompyuterni bloklash"""
    if IS_WINDOWS:
        ctypes.windll.user32.LockWorkStation()
    log("Bloklandi")

def set_volume(level):
    """Ovoz darajasini o'rnatish (0-100)"""
    level = max(0, min(int(level), 100))
    if IS_WINDOWS:
        from ctypes import cast, POINTER
        try:
            from comtypes import CLSCTX_ALL
            from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
            devices = AudioUtilities.GetSpeakers()
            interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
            volume = cast(interface, POINTER(IAudioEndpointVolume))
            volume.SetMasterVolumeLevelScalar(level / 100.0, None)
        except Exception as e:
            log(f"Ovoz sozlash xatosi: {e}")
    log(f"Ovoz: {level}%")

def take_screenshot():
    """Screenshot olish"""
    try:
        import mss
        import mss.tools
        with mss.mss() as sct:
            monitor = sct.monitors[1]
            img = sct.grab(monitor)
            # PNG ga aylantirish
            import io
            from PIL import Image
            img_pil = Image.frombytes("RGB", img.size, img.bgra, "raw", "BGRX")
            # Kichraytirish (tezlik uchun)
            img_pil = img_pil.resize((1280, 720))
            buf = io.BytesIO()
            img_pil.save(buf, format='JPEG', quality=50)
            return base64.b64encode(buf.getvalue()).decode('utf-8')
    except Exception as e:
        print(f"Screenshot xatosi: {e}")
        return None

def block_apps():
    """Ruxsatsiz dasturlarni bloklash"""
    blocked = ["chrome.exe", "firefox.exe", "telegram.exe", "discord.exe"]
    if IS_WINDOWS:
        for app in blocked:
            subprocess.run(["taskkill", "/f", "/im", app], capture_output=True)
    log("Dasturlar bloklandi")

async def send_status(ws, status, data=None):
    await ws.send(json.dumps({
        "type": "status_update",
        "monitorId": MONITOR_ID,
        "status": status,
        "data": data or {}
    }))

async def send_screenshot(ws):
    img = take_screenshot()
    if img:
        await ws.send(json.dumps({
            "type": "screenshot",
            "monitorId": MONITOR_ID,
            "image": img
        }))

async def handle_command(ws, msg):
    command = msg.get("command")
    params  = msg.get("params", {})
    log(f"Buyruq: {command}")

    if command == "monitor_off":
        turn_off_monitor()
        await send_status(ws, "off")
    elif command == "monitor_on":
        turn_on_monitor()
        await send_status(ws, "on")
    elif command == "sleep":
        sleep_monitor()
        await send_status(ws, "sleep")
    elif command == "restart":
        await send_status(ws, "restarting")
        restart_pc()
    elif command == "shutdown":
        await send_status(ws, "off")
        shutdown_pc()
    elif command == "lock":
        lock_pc()
        await send_status(ws, "locked")
    elif command == "screenshot":
        await send_screenshot(ws)
    elif command == "set_volume":
        set_volume(params.get("level", 50))
    elif command == "block_apps":
        block_apps()
        await send_status(ws, "on")
    elif command == "ping":
        await send_status(ws, "on", {"pong": True, "time": datetime.now().isoformat()})
    else:
        log(f"Noma'lum buyruq: {command}")

async def connect():
    info = get_system_info()
    print(f"\n=== Monitor Agent {MONITOR_ID} ===")
    print(f"Xona: {ROOM_NAME}")
    print(f"Server: {SERVER_URL}")
    print(f"=========================\n")

    while True:
        try:
            log("Serverga ulanmoqda...")
            async with websockets.connect(SERVER_URL, ping_interval=30) as ws:
                info = get_system_info()
                # Salomlashish
                await ws.send(json.dumps({
                    "type": "agent_hello",
                    "monitorId": MONITOR_ID,
                    "info": info
                }))
                log("Ulandi!")

                # Screenshot har 30 sekundda
                async def periodic_screenshot():
                    while True:
                        await asyncio.sleep(30)
                        await send_screenshot(ws)

                screenshot_task = asyncio.create_task(periodic_screenshot())

                # Buyruqlarni kutish
                async for message in ws:
                    msg = json.loads(message)
                    if msg.get("type") == "command":
                        await handle_command(ws, msg)
                screenshot_task.cancel()

        except Exception as e:
            log(f"Xato: {e}")
            print("5 sekunddan keyin qayta uriniladi...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    try:
        asyncio.run(connect())
    except KeyboardInterrupt:
        print("\n[INFO] Agent to'xtatildi. Ctrl+C bosildi.")
