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

    // POS Issue Receipt Printing (BR-005)
    @POST("api/v1/issues/{id}/print-receipt")
    suspend fun recordReceiptPrinted(
        @Path("id") id: String,
        @Body request: RecordReceiptPrintedRequestDto
    ): Response<Any>

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

    // Replenishment Endpoints (Point #2)
    @GET("api/v1/replenishment/recommendations")
    suspend fun getReplenishmentRecommendations(
        @Query("warehouse_id") warehouseId: String
    ): Response<List<ReplenishmentRecommendationDto>>

    @POST("api/v1/replenishment/requests")
    suspend fun createReplenishmentRequest(
        @Body request: CreateReplenishmentRequestDto
    ): Response<Any>

    @POST("api/v1/replenishment/requests/{id}/receive")
    suspend fun receiveReplenishmentDrop(
        @Path("id") requestId: String
    ): Response<Any>

    // Warehouse Bins & Guided Put-Away Endpoints (Point #2)
    @GET("api/v1/warehouses/{warehouse_id}/bins")
    suspend fun getWarehouseBins(
        @Path("warehouse_id") warehouseId: String
    ): Response<List<WarehouseBinItemDto>>

    @POST("api/v1/warehouses/{warehouse_id}/bins/relocate")
    suspend fun relocateStockBin(
        @Path("warehouse_id") warehouseId: String,
        @Body request: RelocateStockBinRequestDto
    ): Response<Any>

    // Mechanic Stock Requests Endpoints
    @GET("api/v1/mechanic-requests/me/context")
    suspend fun getMechanicContext(): Response<MechanicContextDto>

    @GET("api/v1/mechanic-requests/summary")
    suspend fun getMechanicRequestSummary(
        @Query("warehouse_id") warehouseId: String? = null
    ): Response<MechanicRequestSummaryDto>

    @GET("api/v1/mechanic-requests")
    suspend fun getMechanicRequests(
        @Query("warehouse_id") warehouseId: String? = null,
        @Query("status") status: String? = null,
        @Query("search") search: String? = null,
        @Query("mine") mine: Boolean? = null
    ): Response<List<MechanicRequestDto>>

    @GET("api/v1/mechanic-requests/{id}")
    suspend fun getMechanicRequestDetail(
        @Path("id") id: String,
        @Query("warehouse_id") warehouseId: String? = null
    ): Response<MechanicRequestDetailDto>

    @POST("api/v1/mechanic-requests")
    suspend fun createMechanicRequest(
        @Query("force") force: Boolean? = null,
        @Body request: CreateMechanicRequestDto
    ): Response<CreateMechanicRequestResponseDto>

    @POST("api/v1/mechanic-requests/{id}/approve")
    suspend fun approveMechanicRequest(
        @Path("id") id: String,
        @Body request: ApproveMechanicRequestDto
    ): Response<Any>

    @POST("api/v1/mechanic-requests/{id}/request-revision")
    suspend fun requestRevisionMechanicRequest(
        @Path("id") id: String,
        @Body request: RequestRevisionDto
    ): Response<Any>

    @POST("api/v1/mechanic-requests/{id}/reject")
    suspend fun rejectMechanicRequest(
        @Path("id") id: String,
        @Body request: RejectMechanicRequestDto
    ): Response<Any>

    @POST("api/v1/mechanic-requests/{id}/cancel")
    suspend fun cancelMechanicRequest(
        @Path("id") id: String,
        @Body request: CancelMechanicRequestDto
    ): Response<Any>

    @POST("api/v1/mechanic-requests/{id}/fulfill")
    suspend fun fulfillMechanicRequest(
        @Path("id") id: String,
        @Body request: FulfillMechanicRequestDto
    ): Response<Any>

    // Sprint 4: Replenishment Approval & Dispatch Hub
    @GET("api/v1/replenishment/requests")
    suspend fun getReplenishmentRequests(
        @Query("warehouse_id") warehouseId: String? = null,
        @Query("status") status: String? = null
    ): Response<List<ReplenishmentRequestDto>>

    @PUT("api/v1/replenishment/requests/{id}/verify")
    suspend fun verifyReplenishmentRequest(
        @Path("id") id: String,
        @Body request: VerifyReplenishmentRequestDto
    ): Response<Any>

    @PUT("api/v1/replenishment/requests/{id}/approve")
    suspend fun approveReplenishmentRequest(
        @Path("id") id: String,
        @Body request: ApproveReplenishmentRequestDto
    ): Response<Any>

    @PUT("api/v1/replenishment/requests/{id}/supervisor-reject")
    suspend fun rejectSupervisorReplenishmentRequest(
        @Path("id") id: String,
        @Body request: RejectReplenishmentRequestDto
    ): Response<Any>

    @PUT("api/v1/replenishment/requests/{id}/return-to-container")
    suspend fun returnToContainerReplenishmentRequest(
        @Path("id") id: String,
        @Body request: RejectReplenishmentRequestDto
    ): Response<Any>

    // Sprint 4: Used Part Returns (BR-004 Core Return)
    @GET("api/v1/returns")
    suspend fun getUsedPartReturns(
        @Query("warehouse_id") warehouseId: String? = null,
        @Query("status") status: String? = null,
        @Query("search") search: String? = null
    ): Response<List<UsedPartReturnDto>>

    @POST("api/v1/returns/{id}/receive-container")
    suspend fun receiveContainerReturn(
        @Path("id") id: String,
        @Body request: ReceiveContainerReturnRequestDto
    ): Response<Any>

    @POST("api/v1/returns/{id}/transfer-main")
    suspend fun transferCoreToMain(
        @Path("id") id: String,
        @Body payload: Map<String, String> = emptyMap()
    ): Response<Any>

    // Master Equipment & Employee (Quick-Add POS & Mechanic)
    @GET("api/v1/master/equipment")
    suspend fun getEquipment(
        @Query("search") search: String? = null
    ): Response<List<EquipmentDto>>

    @POST("api/v1/master/equipment")
    suspend fun createEquipment(
        @Body request: CreateEquipmentDto
    ): Response<EquipmentDto>

    @GET("api/v1/master/employees")
    suspend fun getEmployees(): Response<List<EmployeeDto>>

    @POST("api/v1/master/employees")
    suspend fun createEmployee(
        @Body request: CreateEmployeeDto
    ): Response<EmployeeDto>
}


