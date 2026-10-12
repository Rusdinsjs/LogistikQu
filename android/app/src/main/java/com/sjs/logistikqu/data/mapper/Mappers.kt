package com.sjs.logistikqu.data.mapper

import com.sjs.logistikqu.data.api.models.StockItemDto
import com.sjs.logistikqu.data.database.entities.InventoryCacheEntity
import com.sjs.logistikqu.data.database.entities.SyncQueueEntity
import com.sjs.logistikqu.domain.entities.*

fun InventoryCacheEntity.toDomain(): InventoryStock = InventoryStock(
    id = id,
    warehouseId = warehouse_id,
    sparePartId = part_number,
    partNumber = part_number,
    partName = part_name,
    uom = "PCS",
    qtyOnHand = quantity,
    binCode = location_id,
    zone = null,
    shelfLevel = null,
    batchNumber = null,
    serialNumber = null,
    status = if (quantity <= 0) "OUT_OF_STOCK" else if (quantity <= minimum_stock) "LOW" else "NORMAL"
)

fun StockItemDto.toCacheEntity(): InventoryCacheEntity = InventoryCacheEntity(
    id = id,
    part_number = sparePartId,
    part_name = partName,
    warehouse_id = warehouseId,
    location_id = binCode,
    quantity = qtyOnHand,
    minimum_stock = minStock ?: 5.0,
    updated_at = System.currentTimeMillis(),
    sync_status = "SYNCED"
)

fun SyncQueueEntity.toDomain(): SyncQueueItem = SyncQueueItem(
    id = id,
    transactionType = transaction_type,
    payload = payload,
    status = status,
    retryCount = retry_count,
    createdAt = created_at,
    updatedAt = updated_at,
    errorMessage = last_error
)

fun com.sjs.logistikqu.data.api.models.ReplenishmentRecommendationDto.toDomain(): ReplenishmentRecommendation = ReplenishmentRecommendation(
    sparePartId = sparePartId,
    partName = partName,
    unitOfMeasure = unitOfMeasure,
    currentStock = currentStock,
    minStock = minStock,
    maxStock = maxStock,
    safetyStock = safetyStock,
    leadTimeDays = leadTimeDays,
    avgDailyUsage = avgDailyUsage,
    recommendedOrderQty = recommendedOrderQty,
    reorderPoint = reorderPoint,
    consumptionTrend = consumptionTrend
)

fun com.sjs.logistikqu.data.api.models.WarehouseBinItemDto.toDomain(): WarehouseBin = WarehouseBin(
    id = id,
    warehouseId = warehouseId,
    binCode = binCode,
    zone = zone ?: "A",
    shelfLevel = shelfLevel ?: "1",
    capacityParts = capacityParts ?: 50,
    currentItemsCount = currentItemsCount ?: 0L,
    totalQty = totalQty ?: 0.0,
    description = description
)

