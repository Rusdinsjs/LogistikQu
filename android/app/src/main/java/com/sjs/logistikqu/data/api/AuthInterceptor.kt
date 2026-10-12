package com.sjs.logistikqu.data.api

import com.sjs.logistikqu.data.datastore.UserPreferencesManager
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val preferencesManager: UserPreferencesManager
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        // 1. Dynamic Host & Port Resolution based on active server_url
        val configuredUrlStr = runBlocking { preferencesManager.serverUrlFlow.first() }
        val targetHttpUrl = configuredUrlStr.toHttpUrlOrNull()

        val newUrl = if (targetHttpUrl != null) {
            originalRequest.url.newBuilder()
                .scheme(targetHttpUrl.scheme)
                .host(targetHttpUrl.host)
                .port(targetHttpUrl.port)
                .build()
        } else {
            originalRequest.url
        }

        val requestBuilder = originalRequest.newBuilder()
            .url(newUrl)
            .header("Accept", "application/json")
            .header("User-Agent", "LogistikQu-Android-Client/2.0")

        // 2. Attach JWT token for authenticated endpoints
        val isLoginRequest = originalRequest.url.encodedPath.contains("auth/login")
        if (!isLoginRequest) {
            val token = runBlocking { preferencesManager.authTokenFlow.first() }
            if (!token.isNullOrBlank()) {
                requestBuilder.header("Authorization", "Bearer $token")
            }
        }

        val response = chain.proceed(requestBuilder.build())

        // 3. Handle 401 Unauthorized token expiry
        if (response.code == 401 && !isLoginRequest) {
            runBlocking {
                preferencesManager.clearAuth()
            }
        }

        return response
    }
}
