# ==============================================================================
# ProGuard / R8 Rules for An Gia Smart Home 3D
# Capacitor 8 + React 19 + Android 15/16 (API 35/36)
# ==============================================================================

# 1. Bảo vệ cầu nối Capacitor Core, Bridge & Plugins
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep public class * extends com.getcapacitor.BridgeActivity { *; }
-keep class com.angia.smarthome3d.** { *; }

# 2. Bảo vệ chú thích JavascriptInterface (Cực kỳ quan trọng để React 19 giao tiếp với Native)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keepattributes *Annotation*

# 3. Bảo vệ Android WebView & AndroidX Webkit
-keep class androidx.webkit.** { *; }
-keep interface androidx.webkit.** { *; }
-keep class android.webkit.** { *; }

# 4. Bảo tồn thông tin StackTrace để chẩn đoán lỗi Production
-keepattributes SourceFile,LineNumberTable
-keepattributes Signature
-keepattributes Exceptions
-renamesourcefileattribute SourceFile

# 5. Khả năng tương thích plugin Cordova (nếu có)
-keep class org.apache.cordova.** { *; }
-keep interface org.apache.cordova.** { *; }

# 6. Ngăn chặn R8 gỡ bỏ các thư viện hỗ trợ JSON & Kotlin Metadata
-keepclassmembers class * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
