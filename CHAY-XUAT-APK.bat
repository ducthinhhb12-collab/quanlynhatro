@echo off
title Bien Dich File APK Android Native - An Gia Smart Home 3D
echo ========================================================
echo   DANG CHUAN BI XUAT FILE CAI DAT ANDROID (.APK)...
echo ========================================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\build-apk-local.ps1"
echo.
pause
