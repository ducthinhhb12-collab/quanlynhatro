# ==============================================================================
# Script: generate-keystore.ps1
# Mục đích: Tự động sinh khóa bảo mật số Android Keystore (RSA 4096-bit, 27 năm),
#           mã hóa chuỗi Base64 cho GitHub Secrets và trích xuất mã SHA-256 cho Firebase
# Dự án: An Gia Smart Home 3D (Capacitor 8 + React 19)
# ==============================================================================

[CmdletBinding()]
param(
    [string]$KeystorePassword = "",
    [string]$KeyPassword = "",
    [string]$KeyAlias = "angia-key-alias",
    [string]$DName = "CN=An Gia Smart Home 3D, OU=Mobile Security, O=An Gia Group, L=Ho Chi Minh, ST=Ho Chi Minh, C=VN"
)

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   AN GIA SMART HOME 3D - BỘ CÔNG CỤ SINH KHÓA PRODUCTION NATIVE " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Tìm kiếm công cụ keytool của JDK
$KeytoolPath = "keytool"
try {
    $null = Get-Command "keytool" -ErrorAction Stop
} catch {
    $PotentialPaths = @(
        "$env:JAVA_HOME\bin\keytool.exe",
        "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe",
        "C:\Program Files\Java\jdk*\bin\keytool.exe",
        "C:\Program Files\Eclipse Adoptium\jdk*\bin\keytool.exe",
        "C:\Program Files\Microsoft\jdk*\bin\keytool.exe"
    )
    $Found = $false
    foreach ($p in $PotentialPaths) {
        $resolved = Resolve-Path $p -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($resolved -and (Test-Path $resolved.Path)) {
            $KeytoolPath = $resolved.Path
            $Found = $true
            break
        }
    }
    if (-not $Found) {
        Write-Error "Không tìm thấy công cụ 'keytool'. Vui lòng cài đặt Java JDK (JDK 17 hoặc 21) hoặc cấu hình biến môi trường JAVA_HOME."
        exit 1
    }
}
Write-Host "-> Sử dụng keytool tại: $KeytoolPath" -ForegroundColor Green

# 2. Xác định mật khẩu khóa
if ([string]::IsNullOrWhiteSpace($KeystorePassword)) {
    $KeystorePassword = Read-Host -Prompt "Nhập mật khẩu cho Keystore (hoặc Enter để dùng mặc định an toàn)"
    if ([string]::IsNullOrWhiteSpace($KeystorePassword)) {
        $KeystorePassword = "AngiaSmartHome2026!Secured"
        Write-Host "-> Sử dụng mật khẩu mặc định: $KeystorePassword" -ForegroundColor Yellow
    }
}

if ([string]::IsNullOrWhiteSpace($KeyPassword)) {
    $KeyPassword = $KeystorePassword
}

# 3. Đường dẫn lưu tệp keystore
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$TargetDir = Join-Path $ProjectRoot "android\app"
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}
$KeystoreFile = Join-Path $TargetDir "angia-release-key.jks"

if (Test-Path $KeystoreFile) {
    $Overwrite = Read-Host -Prompt "Tệp '$KeystoreFile' đã tồn tại. Bạn có muốn ghi đè? (y/N)"
    if ($Overwrite -notmatch "^[yY]$") {
        Write-Host "-> Hủy tạo khóa mới. Giữ lại tệp khóa hiện tại." -ForegroundColor Yellow
    } else {
        Remove-Item $KeystoreFile -Force
    }
}

if (-not (Test-Path $KeystoreFile)) {
    Write-Host "-> Đang tạo tệp khóa RSA 4096-bit (Thời hạn 10.000 ngày)..." -ForegroundColor Yellow
    
    $KeytoolArgs = @(
        "-genkeypair",
        "-v",
        "-keystore", $KeystoreFile,
        "-alias", $KeyAlias,
        "-keyalg", "RSA",
        "-keysize", "4096",
        "-validity", "10000",
        "-storepass", $KeystorePassword,
        "-keypass", $KeyPassword,
        "-dname", $DName,
        "-deststoretype", "JKS"
    )
    
    & $KeytoolPath @KeytoolArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Lỗi khi sinh khóa với keytool (Mã lỗi: $LASTEXITCODE)"
        exit $LASTEXITCODE
    }
    Write-Host "-> Đã tạo thành công: $KeystoreFile" -ForegroundColor Green
}

# 4. Trích xuất mã Base64 để nhúng vào GitHub Secrets
$KeystoreBytes = [System.IO.File]::ReadAllBytes($KeystoreFile)
$Base64String = [System.Convert]::ToBase64String($KeystoreBytes)

$Base64File = Join-Path $ProjectRoot "keystore-base64.txt"
Set-Content -Path $Base64File -Value $Base64String -NoNewline
Write-Host "-> Đã xuất chuỗi Base64 ra: $Base64File (Đã được chặn bởi .gitignore)" -ForegroundColor Green

# 5. Tạo tệp cấu hình android/keystore.properties cho môi trường cục bộ
$LocalPropsFile = Join-Path $ProjectRoot "android\keystore.properties"
$PropsContent = @"
KEYSTORE_FILE=angia-release-key.jks
KEYSTORE_PASSWORD=$KeystorePassword
KEY_ALIAS=$KeyAlias
KEY_PASSWORD=$KeyPassword
"@
Set-Content -Path $LocalPropsFile -Value $PropsContent
Write-Host "-> Đã tạo tệp cấu hình cục bộ: $LocalPropsFile" -ForegroundColor Green

# 6. Trích xuất mã vân tay SHA-256 (Certificate Fingerprint) cho Firebase & Google Play
Write-Host "`n------------------ THÔNG TIN CHỨNG CHỈ BẢO MẬT SỐ ------------------" -ForegroundColor Cyan
$CertInfo = & $KeytoolPath -list -v -keystore $KeystoreFile -alias $KeyAlias -storepass $KeystorePassword
$Sha256Line = $CertInfo | Select-String "SHA256:"
$Sha1Line = $CertInfo | Select-String "SHA1:"

Write-Host "Tên Alias : $KeyAlias" -ForegroundColor White
if ($Sha1Line) { Write-Host $Sha1Line -ForegroundColor White }
if ($Sha256Line) { Write-Host $Sha256Line -ForegroundColor Yellow }

Write-Host "`n------------------ HƯỚNG DẪN CẤU HÌNH GITHUB SECRETS ---------------" -ForegroundColor Cyan
Write-Host "Vào GitHub Repo -> Settings -> Secrets and variables -> Actions -> New repository secret:" -ForegroundColor White
Write-Host "1. ANDROID_KEYSTORE_BASE64 : [Nội dung trong tệp keystore-base64.txt]" -ForegroundColor Yellow
Write-Host "2. KEYSTORE_PASSWORD       : $KeystorePassword" -ForegroundColor Yellow
Write-Host "3. KEY_ALIAS               : $KeyAlias" -ForegroundColor Yellow
Write-Host "4. KEY_PASSWORD            : $KeyPassword" -ForegroundColor Yellow
Write-Host "=====================================================================`n" -ForegroundColor Cyan
