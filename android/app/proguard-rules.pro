# LogistikQu Enterprise Mobile Proguard Rules

# Keep Room database models
-keep class androidx.room.** { *; }
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# Keep Retrofit and Gson models
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keep,allowobfuscation,allowshrinking class com.google.gson.** { *; }
-keepattributes Signature
-keepattributes *Annotation*

# Keep ML Kit Barcode models
-keep class com.google.mlkit.vision.barcode.** { *; }

# Keep Hilt generated classes
-keep class * extends com.google.dagger.hilt.** { *; }
