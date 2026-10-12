package com.sjs.logistikqu.data.api

import com.sjs.logistikqu.data.api.models.*
import retrofit2.Response
import retrofit2.http.*

interface LogistikQuApiService {

    @POST("api/v1/auth/login")
    suspend fun login(@Body request: LoginRequestDto): Response<LoginResponseDto>

    @POST("api/v1/auth/refresh")
    suspend fun refreshToken(@Body request: RefreshTokenRequestDto): Response<RefreshTokenResponseDto>

    // Mobile Batch Sync API (Offline-First Distributed Engine)
    @POST("api/mobile/sync")
    suspend fun batchSync(@Body request: MobileBatchSyncRequestDto): Response<MobileBatchSyncResponseDto>

    // Delta Pull API (Lightweight changes only)
    @GET("api/mobile/pull")
    suspend fun pullDelta(
        @Query("warehouse_id") warehouseId: String,
        @Query("last_sync") lastSyncTimestamp: Long?
    ): Response<MobileDeltaPullResponseDto>

    // Conflict Resolution API
    @POST("api/mobile/conflict-resolution")
    suspend fun resolveConflict(@Body request: ConflictResolutionRequestDto): Response<ApiResponseDto<Unit>>

    // Legacy direct endpoints
    @GET("api/v1/inventory/stock")
    suspend fun getInventoryStock(
        @Query("warehouse_id") warehouseId: String,
        @Query("search") search: String? = null
    ): Response<List<StockItemDto>>

    // Notification API
    @GET("api/v1/notifications/unread-count")
    suspend fun getUnreadNotificationCount(): Response<NotificationUnreadCountDto>

    @GET("api/v1/notifications")
    suspend fun getNotifications(
        @Query("limit") limit: Int = 30
    ): Response<List<MobileNotificationDto>>

    @PUT("api/v1/notifications/{id}/read")
    suspend fun markNotificationAsRead(
        @Path("id") id: String
    ): Response<ApiResponseDto<Unit>>

    @PUT("api/v1/notifications/read-all")
    suspend fun markAllNotificationsAsRead(): Response<ApiResponseDto<Unit>>
}
