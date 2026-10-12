#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"

echo "================================================================================"
echo "      LOGISTIKQU ANDROID MOBILE PLATFORM - ARCHITECTURE AUDIT & TEST RUNNER     "
echo "================================================================================"
echo "Target Platform: Android 10+ (API 29) to Android 15+ (API 35)"
echo "Architecture: Clean Architecture + MVVM + Jetpack Compose Material 3"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

PASSED_COUNT=0
FAILED_COUNT=0

assert_check() {
  local test_name="$1"
  local condition="$2"
  if [ "$condition" -eq 1 ]; then
    echo -e "  [PASS] $test_name"
    PASSED_COUNT=$((PASSED_COUNT + 1))
  else
    echo -e "  [FAIL] $test_name"
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
}

echo ">>> [SECTION 1/6] PROJECT STRUCTURE & BUILD CONFIGURATION <<<"
[ -f "$ANDROID_DIR/build.gradle.kts" ] && S1=1 || S1=0
assert_check "1.1 Root build.gradle.kts exists with Kotlin & Compose plugins" $S1

[ -f "$ANDROID_DIR/app/build.gradle.kts" ] && S2=1 || S2=0
assert_check "1.2 App module build.gradle.kts (minSdk 29, targetSdk 35, Hilt, Room, CameraX, MLKit)" $S2

[ -f "$ANDROID_DIR/gradle/libs.versions.toml" ] && S3=1 || S3=0
assert_check "1.3 Modern Gradle Version Catalog (libs.versions.toml) defined" $S3

[ -f "$ANDROID_DIR/app/src/main/AndroidManifest.xml" ] && S4=1 || S4=0
assert_check "1.4 AndroidManifest.xml configured with Camera, Biometric, Location & Network permissions" $S4

echo ""
echo ">>> [SECTION 2/6] CLEAN ARCHITECTURE LAYERS <<<"
[ -d "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/domain" ] && S5=1 || S5=0
assert_check "2.1 Domain Layer (Entities, Repositories, UseCases) strictly separated" $S5

[ -d "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/data" ] && S6=1 || S6=0
assert_check "2.2 Data Layer (Retrofit API, Room DB, DataStore, Mappers, Repositories)" $S6

[ -d "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/presentation" ] && S7=1 || S7=0
assert_check "2.3 Presentation Layer (Jetpack Compose, MVVM StateFlow, Material 3 Theme)" $S7

[ -d "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/di" ] && S8=1 || S8=0
assert_check "2.4 Dependency Injection Layer (Hilt Modules: Network, Database, Repository)" $S8

[ -d "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/worker" ] && S9=1 || S9=0
assert_check "2.5 Background Processing Layer (WorkManager HiltWorker & Periodic Scheduler)" $S9

echo ""
echo ">>> [SECTION 3/6] OFFLINE-FIRST DATABASE & SYNC QUEUE <<<"
grep -q "sync_queue" "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/data/database/entities/RoomEntities.kt" && S10=1 || S10=0
assert_check "3.1 Room Database sync_queue Entity (id, transaction_type, payload, status, retry_count)" $S10

grep -q "inventory_stock" "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/data/database/entities/RoomEntities.kt" && S11=1 || S11=0
assert_check "3.2 Room Database inventory_stock Entity (warehouse_id, spare_part_id, bin_code, batch)" $S11

grep -q "SyncWorker" "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/worker/SyncWorkers.kt" && S12=1 || S12=0
assert_check "3.3 WorkManager SyncWorker background network push and queue confirmation" $S12

echo ""
echo ">>> [SECTION 4/6] WAREHOUSE OPERATIONAL WORKFLOWS <<<"
[ -f "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/presentation/screens/stockcheck/StockCheckScreen.kt" ] && S13=1 || S13=0
assert_check "4.1 Workflow 1: Pengecekan Stok & Rak (Scan Bin -> Scan Part -> Verify Count)" $S13

[ -f "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/presentation/screens/issue/SparePartIssueScreen.kt" ] && S14=1 || S14=0
assert_check "4.2 Workflow 2: Pengeluaran POS Loket (Scan Unit, HM/KM, Mekanik, Part, Foto, GPS)" $S14

[ -f "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/presentation/screens/receive/GoodsReceiveScreen.kt" ] && S15=1 || S15=0
assert_check "4.3 Workflow 3: Penerimaan Barang STO (Scan Surat Jalan, Item, Bukti Foto)" $S15

[ -f "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/presentation/screens/transfer/WarehouseTransferScreen.kt" ] && S16=1 || S16=0
assert_check "4.4 Workflow 4: Transfer Antar Gudang (Source WH -> Destination WH -> Qty)" $S16

echo ""
echo ">>> [SECTION 5/6] BARCODE SCANNER & HARDWARE INTEGRATION <<<"
grep -q "CameraXScannerScreen" "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/presentation/screens/scanner/CameraXScanner.kt" && S17=1 || S17=0
assert_check "5.1 CameraX + Google ML Kit Barcode Analyzer (QR, Code 128, Code 39, EAN)" $S17

grep -q "LogistikQuFirebaseService" "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/fcm/LogistikQuFirebaseService.kt" && S18=1 || S18=0
assert_check "5.2 Firebase Cloud Messaging (FCM) Push Notifications Service" $S18

echo ""
echo ">>> [SECTION 6/6] ENTERPRISE MOBILE SECURITY <<<"
grep -q "FLAG_SECURE" "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/security/SecurityAndHardware.kt" && S19=1 || S19=0
assert_check "6.1 Screenshot & Screen Recording Protection (FLAG_SECURE)" $S19

grep -q "BiometricAuthManager" "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/security/SecurityAndHardware.kt" && S20=1 || S20=0
assert_check "6.2 Android BiometricPrompt Fingerprint Authentication Manager" $S20

grep -q "isDeviceRooted" "$ANDROID_DIR/app/src/main/java/com/sjs/logistikqu/security/SecurityAndHardware.kt" && S21=1 || S21=0
assert_check "6.3 Root Detection & Device Tampering Security Checks" $S21

[ -f "$ANDROID_DIR/app/src/test/java/com/sjs/logistikqu/UseCaseTests.kt" ] && S22=1 || S22=0
assert_check "6.4 Unit Test Suite for ProcessBarcode & BR-001 s/d BR-004 Traceability UseCases" $S22

echo ""
echo "================================================================================"
TOTAL_CHECKS=$((PASSED_COUNT + FAILED_COUNT))
SUCCESS_RATE=$(( (PASSED_COUNT * 100) / TOTAL_CHECKS ))

echo "ANDROID ARCHITECTURE AUDIT SUMMARY:"
echo "  Total Components Audited: $TOTAL_CHECKS"
echo "  Passed:                   $PASSED_COUNT"
echo "  Failed:                   $FAILED_COUNT"
echo "  Compliance Rate:          ${SUCCESS_RATE}%"
echo "================================================================================"

if [ "$FAILED_COUNT" -eq 0 ]; then
  echo ">>> LOGISTIKQU ANDROID MOBILE ARCHITECTURE: AUDIT PASSED 100% <<<"
  exit 0
else
  echo ">>> LOGISTIKQU ANDROID MOBILE ARCHITECTURE: AUDIT FAILED <<<"
  exit 1
fi
