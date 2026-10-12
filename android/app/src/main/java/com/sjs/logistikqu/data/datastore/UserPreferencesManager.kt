package com.sjs.logistikqu.data.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "logistikqu_secure_prefs")

@Singleton
class UserPreferencesManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private object Keys {
        val AUTH_TOKEN = stringPreferencesKey("auth_token")
        val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        val USER_ID = stringPreferencesKey("user_id")
        val USERNAME = stringPreferencesKey("username")
        val FULL_NAME = stringPreferencesKey("full_name")
        val ROLE = stringPreferencesKey("role")
        val PERMISSIONS = stringPreferencesKey("permissions")
        val WAREHOUSE_ID = stringPreferencesKey("warehouse_id")
        val DEVICE_ID = stringPreferencesKey("device_id")
        val APP_VERSION = stringPreferencesKey("app_version")
        val BIOMETRIC_ENABLED = booleanPreferencesKey("biometric_enabled")
        val LAST_SYNC_TIME = longPreferencesKey("last_sync_time")
        val IS_DEVICE_BOUND = booleanPreferencesKey("is_device_bound")
        val SERVER_URL = stringPreferencesKey("server_url")
    }

    val authTokenFlow: Flow<String?> = context.dataStore.data.map { prefs -> prefs[Keys.AUTH_TOKEN] }
    val refreshTokenFlow: Flow<String?> = context.dataStore.data.map { prefs -> prefs[Keys.REFRESH_TOKEN] }
    val userIdFlow: Flow<String?> = context.dataStore.data.map { prefs -> prefs[Keys.USER_ID] }
    val usernameFlow: Flow<String?> = context.dataStore.data.map { prefs -> prefs[Keys.USERNAME] }
    val fullNameFlow: Flow<String?> = context.dataStore.data.map { prefs -> prefs[Keys.FULL_NAME] }
    val roleFlow: Flow<String?> = context.dataStore.data.map { prefs -> prefs[Keys.ROLE] }
    val permissionsFlow: Flow<List<String>> = context.dataStore.data.map { prefs ->
        prefs[Keys.PERMISSIONS]?.split(",")?.map { it.trim() }?.filter { it.isNotEmpty() } ?: emptyList()
    }
    val warehouseIdFlow: Flow<String> = context.dataStore.data.map { prefs -> prefs[Keys.WAREHOUSE_ID] ?: "WH-CONT-HE" }
    val deviceIdFlow: Flow<String> = context.dataStore.data.map { prefs -> prefs[Keys.DEVICE_ID] ?: "ANDROID-WH-001" }
    val appVersionFlow: Flow<String> = context.dataStore.data.map { prefs -> prefs[Keys.APP_VERSION] ?: "2.0.0" }
    val isBiometricEnabledFlow: Flow<Boolean> = context.dataStore.data.map { prefs -> prefs[Keys.BIOMETRIC_ENABLED] ?: false }
    val lastSyncTimeFlow: Flow<Long> = context.dataStore.data.map { prefs -> prefs[Keys.LAST_SYNC_TIME] ?: 0L }
    val isDeviceBoundFlow: Flow<Boolean> = context.dataStore.data.map { prefs -> prefs[Keys.IS_DEVICE_BOUND] ?: true }
    val serverUrlFlow: Flow<String> = context.dataStore.data.map { prefs -> prefs[Keys.SERVER_URL] ?: "https://logistik.sjsgroup.online/" }

    suspend fun setServerUrl(url: String) {
        val sanitized = if (!url.endsWith("/")) "$url/" else url
        context.dataStore.edit { prefs ->
            prefs[Keys.SERVER_URL] = sanitized
        }
    }

    suspend fun saveAuthData(
        token: String,
        refreshToken: String,
        userId: String,
        username: String,
        fullName: String,
        role: String,
        warehouseId: String?,
        permissions: List<String> = emptyList()
    ) {
        context.dataStore.edit { prefs ->
            prefs[Keys.AUTH_TOKEN] = token
            prefs[Keys.REFRESH_TOKEN] = refreshToken
            prefs[Keys.USER_ID] = userId
            prefs[Keys.USERNAME] = username
            prefs[Keys.FULL_NAME] = fullName
            prefs[Keys.ROLE] = role
            prefs[Keys.PERMISSIONS] = permissions.joinToString(",")
            if (warehouseId != null) {
                prefs[Keys.WAREHOUSE_ID] = warehouseId
            }
            if (!prefs.contains(Keys.DEVICE_ID)) {
                prefs[Keys.DEVICE_ID] = "ANDROID-WH-001"
            }
            prefs[Keys.IS_DEVICE_BOUND] = true
        }
    }

    suspend fun setDeviceId(deviceId: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.DEVICE_ID] = deviceId
        }
    }

    suspend fun updateTokens(token: String, refreshToken: String?) {
        context.dataStore.edit { prefs ->
            prefs[Keys.AUTH_TOKEN] = token
            if (refreshToken != null) {
                prefs[Keys.REFRESH_TOKEN] = refreshToken
            }
        }
    }

    suspend fun setBiometricEnabled(enabled: Boolean) {
        context.dataStore.edit { prefs ->
            prefs[Keys.BIOMETRIC_ENABLED] = enabled
        }
    }

    suspend fun recordSyncTime(timestamp: Long = System.currentTimeMillis()) {
        context.dataStore.edit { prefs ->
            prefs[Keys.LAST_SYNC_TIME] = timestamp
        }
    }

    suspend fun clearAuth() {
        context.dataStore.edit { prefs ->
            prefs.remove(Keys.AUTH_TOKEN)
            prefs.remove(Keys.REFRESH_TOKEN)
            prefs.remove(Keys.USER_ID)
            prefs.remove(Keys.USERNAME)
            prefs.remove(Keys.FULL_NAME)
            prefs.remove(Keys.ROLE)
            prefs.remove(Keys.PERMISSIONS)
        }
    }
}
