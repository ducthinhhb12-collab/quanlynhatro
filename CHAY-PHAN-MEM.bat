@echo off
title Khoi Chay An Gia Smart Home 3D
echo ========================================================
echo   DANG KHOI CHAY AN GIA SMART HOME 3D NATIVE...
echo ========================================================
echo.

if exist "%LOCALAPPDATA%\Programs\An Gia Smart Home 3D\An Gia Smart Home 3D.exe" (
    echo [1/2] Dang mo phan mem Desktop Native (.exe)...
    start "" "%LOCALAPPDATA%\Programs\An Gia Smart Home 3D\An Gia Smart Home 3D.exe"
    echo [OK] Da khoi chay phan mem An Gia Smart Home 3D thanh cong!
) else (
    echo [1/2] Dang mo giao dien tren trinh duyet...
    start "" "http://localhost:5173"
)

echo.
echo ========================================================
echo   Ban cung co the mo tren dien thoai tai:
echo   http://192.168.1.12:5173
echo ========================================================
exit
