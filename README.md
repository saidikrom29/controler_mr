# controler_mr

Bu loyiha ikki qismdan iborat:
- `server.js` yordamida ishlaydigan Node.js server
- `agent.py` yordamida klien kompyuterda ishlaydigan Python agent

## Boshlash
1. `controler_mr` papkasiga kiriting:
   ```bat
   cd /d "C:\Users\Admin\Documents\controler_mr"
   ```
2. Serverni o‘rnatish va ishga tushirish:
   ```bat
   npm install
   npm start
   ```
3. Python kutubxonalarini o‘rnatish:
   ```bat
   pip install -r requirements.txt
   ```
4. Agentni ishga tushirish:
   ```bat
   python agent.py
   ```

## Muammolarni bartaraf etish
- `KeyboardInterrupt` xatosi odatda `Ctrl+C` bosilganda paydo bo‘ladi.
- Agent ishlayotgan paytda terminalni yopmaslik yoki `Ctrl+C` bosmaslik kerak.
- Agentni to‘xtatish uchun terminalga qaytib `Ctrl+C` bosing va u toza chiqadi.

## Wi-Fi va IP orqali ishlatish
1. Serverni ishga tushiring:
   ```bat
   cd /d "C:\Users\Admin\Documents\controler_mr"
   npm.cmd install
   npm.cmd start
   ```
2. Server ishga tushganda, terminalda `http://192.168.x.x:3000` kabi tarmoq manzilingiz chiqadi.
3. Agentni terminaldan ishlatishning eng oson yo‘li:
   ```bat
   cd /d "C:\Users\Admin\Documents\controler_mr"
   run_agent.bat 10.77.50.126 3000 02 "Xona 102"
   ```
   Agar siz `run_agent.bat` faylini ishlatmasangiz, quyidagi buyruqlar ham foydali:
   ```bat
   set MCS_SERVER_IP=10.77.50.126
   set MCS_SERVER_PORT=3000
   set MCS_MONITOR_ID=02
   set MCS_ROOM_NAME="Xona 102"
   python agent.py
   ```
4. `run_agent.bat` fayli agentni serverga ulanish uchun kerakli IP va sozlamalarni avtomatik belgilaydi.

## Docker orqali serverni ishga tushirish
Agar Docker o‘rnatilgan bo‘lsa, serverni konteynerda ishlatish uchun quyidagilarni bajaring:

1. Loyihaga kirish:
   ```bat
   cd /d "C:\Users\Admin\Documents\controler_mr"
   ```
2. Docker tasvirini yaratish:
   ```bat
   docker build -t mcs-server .
   ```
3. Docker konteynerini ishga tushirish:
   ```bat
   docker run --name mcs-server -p 3000:3000 -d mcs-server
   ```
4. Brauzerga kirish:
   ```bat
   http://localhost:3000
   ```

Agar `docker compose` ishlatishni istasangiz:
```bat
cd /d "C:\Users\Admin\Documents\controler_mr"
docker compose up -d
```

> Docker konteyner ichidagi server IP `localhost:3000` bo‘ladi, lekin boshqa tarmoqdan ulanish uchun `http://<kompyuter_IP>:3000` ni ishlating.

## Brauzerda ishlash uchun muhim
- Brauzerda `index.html` faylini bevosita `file://` orqali ochmang.
- Avvalo serverni ishga tushiring va keyin quyidagi manzilni oching:
  ```bat
  http://localhost:3000
  ```
- Agar server boshqa kompyuterda bo‘lsa, brauzerga shu IP kiritilsin:
  ```bat
  http://192.168.1.100:3000
  ```
- Login ekranda yangi maydon paydo bo‘ladi: `Server IP:Port`. Bu yerga server manzilingizni yozing, masalan:
  ```bat
  10.77.50.126:3000
  ```

## Qo‘shimcha
Agar siz `install.bat` ni ishga tushirsangiz, u avtomatik ravishda `requirements.txt` dan kutubxonalarni o‘rnatadi.
