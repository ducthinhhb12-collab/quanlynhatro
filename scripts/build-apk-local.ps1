# scripts/build-apk-local.ps1
# Script tự động kiểm tra môi trường và biên dịch file .apk trực tiếp trên máy tính Windows

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  AN GIA SMART HOME 3D - BIÊN DỊCH ANDROID APK NATIVE     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Kiểm tra môi trường Java & Android SDK
$javaInstalled = $null
try {
    $javaInstalled = Get-Command java -ErrorAction SilentlyContinue
} catch {}

$androidHome = $env:ANDROID_HOME
if (-not $androidHome) {
    $androidHome = $env:ANDROID_SDK_ROOT
}

if (-not $javaInstalled -or -not $androidHome) {
    Write-Host "[!] Phát hiện máy tính chưa cấu hình JAVA_HOME hoặc ANDROID_HOME." -ForegroundColor Yellow
    Write-Host "----------------------------------------------------------" -ForegroundColor Gray
    Write-Host "Bạn có 2 lựa chọn để nhận file .apk ngay lập tức:" -ForegroundColor White
    Write-Host ""
    Write-Host "LỰA CHỌN 1 (KHUYÊN DÙNG - KHÔNG CẦN CÀI ĐẶT GÌ THÊM):" -ForegroundColor Green
    Write-Host "Đẩy mã nguồn lên GitHub. GitHub Actions sẽ tự động biên dịch và tạo link tải file AnGiaSmartHome3D.apk:" -ForegroundColor White
    Write-Host "    git add ." -ForegroundColor Gray
    Write-Host "    git commit -m `"build: release native apk`"" -ForegroundColor Gray
    Write-Host "    git push origin main" -ForegroundColor Gray
    Write-Host ""
    Write-Host "LỰA CHỌN 2 (BIÊN DỊCH TRÊN MÁY TÍNH NÀY):" -ForegroundColor Green
    Write-Host "1. Cài đặt OpenJDK 17 (https://adoptium.net/)" -ForegroundColor White
    Write-Host "2. Cài đặt Android Studio và mở dự án bằng lệnh: npm run mobile:android" -ForegroundColor White
    Write-Host "==========================================================" -ForegroundColor Cyan
    exit 0
}

Write-Host "[1/4] Đang biên dịch bản dựng tĩnh Web Vite..." -ForegroundColor Green
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[x] Lỗi khi chạy npm run build!" -ForegroundColor Red
    exit 1
}

Write-Host "[2/4] Đang đồng bộ tài nguyên vào dự án Android Native..." -ForegroundColor Green
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "[x] Lỗi khi chạy npx cap sync android!" -ForegroundColor Red
    exit 1
}

Write-Host "[3/4] Đang chạy Gradle đóng gói APK..." -ForegroundColor Green
Set-Location -Path "android"
.\gradlew.bat assembleDebug --no-daemon
if ($LASTEXITCODE -ne 0) {
    Write-Host "[x] Lỗi khi chạy gradlew.bat assembleDebug!" -ForegroundColor Red
    Set-Location -Path ".."
    exit 1
}
Set-Location -Path ".."

Write-Host "[4/4] Sao chép file cài đặt ra thư mục release..." -ForegroundColor Green
if (-not (Test-Path "release")) {
    New-Item -ItemType Directory -Path "release" | Out-Null
}

$apkSource = "android\app\build\outputs\apk\debug\app-debug.apk"
$apkDest = "release\AnGiaSmartHome3D.apk"

if (Test-Path $apkSource) {
    Copy-Item -Path $apkSource -Destination $apkDest -Force
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  THÀNH CÔNG! ĐÃ XUẤT FILE CÀI ĐẶT ANDROID APK NATIVE:    " -ForegroundColor Green
    Write-Host "  Đường dẫn: $apkDest                                     " -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Host "[!] Không tìm thấy file APK tại $apkSource" -ForegroundColor Red
}
