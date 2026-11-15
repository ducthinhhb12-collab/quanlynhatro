#!/usr/bin/env bash
# ==============================================================================
# Script: generate-keystore.sh
# Mục đích: Tự động sinh khóa bảo mật số Android Keystore (RSA 4096-bit, 27 năm),
#           mã hóa chuỗi Base64 cho GitHub Secrets và trích xuất mã SHA-256 cho Firebase
# Dự án: An Gia Smart Home 3D (Capacitor 8 + React 19)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

KEYSTORE_PASSWORD="${1:-AngiaSmartHome2026!Secured}"
KEY_PASSWORD="${2:-$KEYSTORE_PASSWORD}"
KEY_ALIAS="${3:-angia-key-alias}"
DNAME="CN=An Gia Smart Home 3D, OU=Mobile Security, O=An Gia Group, L=Ho Chi Minh, ST=Ho Chi Minh, C=VN"

echo "================================================================="
echo "   AN GIA SMART HOME 3D - BỘ CÔNG CỤ SINH KHÓA PRODUCTION NATIVE "
echo "================================================================="

TARGET_DIR="$PROJECT_ROOT/android/app"
mkdir -p "$TARGET_DIR"
KEYSTORE_FILE="$TARGET_DIR/angia-release-key.jks"

if [ -f "$KEYSTORE_FILE" ]; then
    echo "-> Cảnh báo: Tệp $KEYSTORE_FILE đã tồn tại. Tạo tệp sao lưu..."
    cp "$KEYSTORE_FILE" "${KEYSTORE_FILE}.bak"
    rm -f "$KEYSTORE_FILE"
fi

echo "-> Đang tạo tệp khóa RSA 4096-bit (Thời hạn 10.000 ngày)..."
keytool -genkeypair -v \
    -keystore "$KEYSTORE_FILE" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 4096 \
    -validity 10000 \
    -storepass "$KEYSTORE_PASSWORD" \
    -keypass "$KEY_PASSWORD" \
    -dname "$DNAME" \
    -deststoretype JKS

echo "-> Đã tạo thành công: $KEYSTORE_FILE"

# 4. Trích xuất mã Base64 để nhúng vào GitHub Secrets
BASE64_FILE="$PROJECT_ROOT/keystore-base64.txt"
base64 -w 0 "$KEYSTORE_FILE" > "$BASE64_FILE" 2>/dev/null || base64 "$KEYSTORE_FILE" > "$BASE64_FILE"
echo "-> Đã xuất chuỗi Base64 ra: $BASE64_FILE (Được bảo vệ bởi .gitignore)"

# 5. Tạo tệp cấu hình android/keystore.properties cho môi trường cục bộ
LOCAL_PROPS_FILE="$PROJECT_ROOT/android/keystore.properties"
cat <<EOF > "$LOCAL_PROPS_FILE"
KEYSTORE_FILE=angia-release-key.jks
KEYSTORE_PASSWORD=$KEYSTORE_PASSWORD
KEY_ALIAS=$KEY_ALIAS
KEY_PASSWORD=$KEY_PASSWORD
EOF
echo "-> Đã tạo tệp cấu hình cục bộ: $LOCAL_PROPS_FILE"

# 6. Trích xuất mã vân tay SHA-256 (Certificate Fingerprint) cho Firebase & Google Play
echo ""
echo "------------------ THÔNG TIN CHỨNG CHỈ BẢO MẬT SỐ ------------------"
keytool -list -v -keystore "$KEYSTORE_FILE" -alias "$KEY_ALIAS" -storepass "$KEYSTORE_PASSWORD" | grep -E "(SHA1|SHA256):" || true

echo ""
echo "------------------ HƯỚNG DẪN CẤU HÌNH GITHUB SECRETS ---------------"
echo "1. ANDROID_KEYSTORE_BASE64 : [Nội dung trong tệp keystore-base64.txt]"
echo "2. KEYSTORE_PASSWORD       : $KEYSTORE_PASSWORD"
echo "3. KEY_ALIAS               : $KEY_ALIAS"
echo "4. KEY_PASSWORD            : $KEY_PASSWORD"
echo "====================================================================="
