# Android Wrapper for MCS

This folder contains a minimal Android app project that opens the existing web UI in a WebView.

## How it works

- `MainActivity.kt` loads the web UI from the server URL `http://172.29.80.1:3000`
- The app requires the MCS server to be running on that address and port
- The login screen is displayed inside the WebView

## Build instructions

1. Install Android Studio and Android SDK.
2. Open `controler_mr/android-app` as an Android project.
3. If needed, install Android SDK Platform 34 and Android SDK Build-Tools.
4. Build the app using `Build > Build Bundle(s) / APK(s) > Build APK(s)`.

## Notes

- This environment does not have Java or Android build tools installed, so APK build is not available here.
- If you want to use a different server address, change the URL in `app/src/main/java/com/mcs/android/MainActivity.kt`.
