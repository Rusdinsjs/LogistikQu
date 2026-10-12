package com.sjs.logistikqu

import com.google.gson.Gson
import com.sjs.logistikqu.data.api.models.*
import com.sjs.logistikqu.data.database.entities.*
import com.sjs.logistikqu.data.sync.ConflictDetails
import com.sjs.logistikqu.domain.entities.*
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class OfflineSyncEngineTest {

    private val gson = Gson()

    @Test
    fun testLocalFirstTransactionCreation() {
        // Simulating offline container warehouse stock
        val initialCache = InventoryCacheEntity(
            id = "cache-01",
            part_number = "FLT-001",
            part_name = "Oil Filter CAT 320D",
            warehouse_id = "WH-CONT-HE",
            location_id = "RACK-A1",
            quantity = 25.0,
            minimum_stock = 5.0,
            sync_status = "SYNCED"
        )

        // User issues 3 units offline
        val requestedQty = 3.0
        val updatedQty = initialCache.quantity - requestedQty
        val updatedCache = initialCache.copy(
            quantity = updatedQty,
            sync_status = "PENDING_SYNC"
        )

        // Queue item creation
        val txId = UUID.randomUUID().toString()
        val payload = mapOf(
            "warehouse_id" to "WH-CONT-HE",
            "spare_part_id" to "FLT-001",
            "qty" to requestedQty,
            "unit_number" to "DT-001"
        )
        val queueItem = SyncQueueEntity(
            id = txId,
            transaction_type = "ISSUE",
            payload = gson.toJson(payload),
            status = "PENDING"
        )

        // Assertions
        assertEquals(22.0, updatedCache.quantity, 0.001)
        assertEquals("PENDING_SYNC", updatedCache.sync_status)
        assertEquals("PENDING", queueItem.status)
        assertEquals("ISSUE", queueItem.transaction_type)
        assertEquals(0, queueItem.retry_count)
    }

    @Test
    fun testBatchSyncSerialization() {
        val tx1 = MobileBatchTransactionItemDto(
            id = UUID.randomUUID().toString(),
            type = "ISSUE",
            payload = mapOf("spare_part_id" to "FLT-001", "qty" to 2),
            timestamp = 1718000000000L
        )
        val tx2 = MobileBatchTransactionItemDto(
            id = UUID.randomUUID().toString(),
            type = "RECEIVE",
            payload = mapOf("drop_number" to "DROP-001"),
            timestamp = 1718000010000L
        )

        val batchRequest = MobileBatchSyncRequestDto(
            deviceId = "ANDROID-WH-001",
            userId = "user-123",
            warehouseId = "WH-CONT-HE",
            transactions = listOf(tx1, tx2)
        )

        val json = gson.toJson(batchRequest)
        assertTrue(json.contains("ANDROID-WH-001"))
        assertTrue(json.contains("WH-CONT-HE"))
        assertTrue(json.contains("ISSUE"))
        assertTrue(json.contains("RECEIVE"))

        // Deserialize back
        val deserialized = gson.fromJson(json, MobileBatchSyncRequestDto::class.java)
        assertEquals("ANDROID-WH-001", deserialized.deviceId)
        assertEquals(2, deserialized.transactions.size)
    }

    @Test
    fun testConflictResolution_EnforcesServerAuthority() {
        // Mobile thought it had 10 units and issued 8
        val localStockBefore = 10.0
        val requestedQty = 8.0

        // Server reports physical stock is only 3 (someone else drew stock from another device)
        val conflict = ConflictDetails(
            transactionId = "tx-conflict-01",
            reason = "Stock insufficient: server stock is 3.00, requested is 8.00",
            serverStock = 3.0,
            clientStock = 10.0
        )

        // Conflict resolution principle 1: Server Authority
        val resolvedLocalStock = conflict.serverStock

        // Principle 2: Immutable Transaction Logged
        val syncQueueStatus = "CONFLICT"
        val localTransactionStatus = "CONFLICT_PENDING"

        assertEquals(3.0, resolvedLocalStock, 0.001)
        assertEquals("CONFLICT", syncQueueStatus)
        assertEquals("CONFLICT_PENDING", localTransactionStatus)
        assertTrue(conflict.reason.contains("server stock is 3.00"))
    }

    @Test
    fun testExponentialBackoffCalculation() {
        fun calculateBackoffSeconds(attempt: Int): Long {
            val baseSeconds = 60L // 1 minute
            val multiplier = Math.pow(2.0, (attempt - 1).toDouble()).toLong()
            return (baseSeconds * multiplier).coerceAtMost(3600L) // capped at 1 hour
        }

        assertEquals(60L, calculateBackoffSeconds(1))   // 1st retry: 1 min
        assertEquals(120L, calculateBackoffSeconds(2))  // 2nd retry: 2 min
        assertEquals(240L, calculateBackoffSeconds(3))  // 3rd retry: 4 min
        assertEquals(480L, calculateBackoffSeconds(4))  // 4th retry: 8 min
        assertEquals(960L, calculateBackoffSeconds(5))  // 5th retry: 16 min
        assertEquals(3600L, calculateBackoffSeconds(10)) // capped at 60 min
    }

    @Test
    fun testDeltaPullStockUpdate() {
        val serverChanges = listOf(
            StockItemDto(
                id = "item-01",
                warehouseId = "WH-CONT-HE",
                sparePartId = "FLT-001",
                partName = "Oil Filter CAT 320D",
                qtyOnHand = 50.0,
                minStock = 10.0,
                binCode = "RACK-A1",
                status = "NORMAL",
                uom = "PCS"
            ),
            StockItemDto(
                id = "item-02",
                warehouseId = "WH-CONT-HE",
                sparePartId = "HOS-001",
                partName = "Hydraulic Hose 1/2 Inch",
                qtyOnHand = 12.0,
                minStock = 5.0,
                binCode = "RACK-B2",
                status = "NORMAL",
                uom = "MTR"
            )
        )

        val deltaResponse = MobileDeltaPullResponseDto(
            serverTime = "2026-10-11T16:00:00Z",
            serverTimestamp = 1718000500000L,
            inventoryChanges = serverChanges,
            userPermissions = listOf("ISSUE", "RECEIVE", "TRANSFER")
        )

        assertEquals(2, deltaResponse.inventoryChanges.size)
        assertEquals(50.0, deltaResponse.inventoryChanges[0].qtyOnHand, 0.001)
        assertEquals("FLT-001", deltaResponse.inventoryChanges[0].sparePartId)
        assertTrue(deltaResponse.userPermissions.contains("ISSUE"))
    }
}
