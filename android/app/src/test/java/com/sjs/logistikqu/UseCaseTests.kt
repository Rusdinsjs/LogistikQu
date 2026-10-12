package com.sjs.logistikqu

import com.sjs.logistikqu.domain.entities.BarcodeType
import com.sjs.logistikqu.domain.entities.IssueTransaction
import com.sjs.logistikqu.domain.repository.IssueRepository
import com.sjs.logistikqu.domain.usecase.IssuePartUseCase
import com.sjs.logistikqu.domain.usecase.ProcessBarcodeUseCase
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class ProcessBarcodeUseCaseTest {

    private val useCase = ProcessBarcodeUseCase()

    @Test
    fun testParseSparePartBarcodePrefixes() {
        val res1 = useCase("FLT-001")
        assertEquals(BarcodeType.PART, res1.type)
        assertEquals("FLT-001", res1.extractedCode)

        val res2 = useCase("HOS-001")
        assertEquals(BarcodeType.PART, res2.type)
        assertEquals("HOS-001", res2.extractedCode)

        val res3 = useCase("PART-9821")
        assertEquals(BarcodeType.PART, res3.type)
        assertEquals("PART-9821", res3.extractedCode)
    }

    @Test
    fun testParseEquipmentUnitBarcode() {
        val res1 = useCase("DT-001")
        assertEquals(BarcodeType.EQUIPMENT, res1.type)
        assertEquals("DT-001", res1.extractedCode)

        val res2 = useCase("EX-201")
        assertEquals(BarcodeType.EQUIPMENT, res2.type)
        assertEquals("EX-201", res2.extractedCode)
    }

    @Test
    fun testParseWarehouseLocationRackBarcode() {
        val res1 = useCase("RACK-HE-A1")
        assertEquals(BarcodeType.LOCATION_BIN, res1.type)
        assertEquals("RACK-HE-A1", res1.extractedCode)

        val res2 = useCase("WH-CONT-HE")
        assertEquals(BarcodeType.LOCATION_BIN, res2.type)
        assertEquals("WH-CONT-HE", res2.extractedCode)
    }

    @Test
    fun testParseShipmentDocBarcode() {
        val res = useCase("DROP-20261011-00004")
        assertEquals(BarcodeType.SHIPMENT_DOC, res.type)
        assertEquals("DROP-20261011-00004", res.extractedCode)
    }
}

class IssuePartUseCaseTest {

    private val fakeRepo = object : IssueRepository {
        override suspend fun submitIssue(issue: IssueTransaction): Result<String> {
            return Result.success("ISSUE-SUCCESS-001")
        }
        override fun getPendingIssuesFlow() = kotlinx.coroutines.flow.emptyFlow<List<IssueTransaction>>()
    }

    private val useCase = IssuePartUseCase(fakeRepo)

    @Test
    fun testIssueValidation_RejectsMissingUnitNumber() = runBlocking {
        val invalid = IssueTransaction(
            localId = "1",
            warehouseId = "WH-CONT-HE",
            siteId = "SITE-VALE-C",
            unitNumber = "", // empty
            currentHmKm = 12500.0,
            mechanicName = "Agus",
            receiverName = "Agus",
            workOrderNumber = "WO-01",
            maintenanceType = "Corrective",
            priority = "HIGH",
            sparePartId = "FLT-001",
            qty = 2.0,
            evidencePhotoPath = null,
            latitude = null,
            longitude = null,
            timestamp = System.currentTimeMillis()
        )
        val res = useCase(invalid)
        assertTrue(res.isFailure)
        assertTrue(res.exceptionOrNull()?.message?.contains("Nomor unit") == true)
    }

    @Test
    fun testIssueValidation_RejectsZeroOrNegativeHmKm() = runBlocking {
        val invalid = IssueTransaction(
            localId = "1",
            warehouseId = "WH-CONT-HE",
            siteId = "SITE-VALE-C",
            unitNumber = "DT-001",
            currentHmKm = 0.0, // invalid HM
            mechanicName = "Agus",
            receiverName = "Agus",
            workOrderNumber = "WO-01",
            maintenanceType = "Corrective",
            priority = "HIGH",
            sparePartId = "FLT-001",
            qty = 2.0,
            evidencePhotoPath = null,
            latitude = null,
            longitude = null,
            timestamp = System.currentTimeMillis()
        )
        val res = useCase(invalid)
        assertTrue(res.isFailure)
        assertTrue(res.exceptionOrNull()?.message?.contains("Hour Meter") == true)
    }

    @Test
    fun testIssueValidation_RejectsZeroQuantity() = runBlocking {
        val invalid = IssueTransaction(
            localId = "1",
            warehouseId = "WH-CONT-HE",
            siteId = "SITE-VALE-C",
            unitNumber = "DT-001",
            currentHmKm = 12500.0,
            mechanicName = "Agus",
            receiverName = "Agus",
            workOrderNumber = "WO-01",
            maintenanceType = "Corrective",
            priority = "HIGH",
            sparePartId = "FLT-001",
            qty = 0.0, // invalid qty
            evidencePhotoPath = null,
            latitude = null,
            longitude = null,
            timestamp = System.currentTimeMillis()
        )
        val res = useCase(invalid)
        assertTrue(res.isFailure)
        assertTrue(res.exceptionOrNull()?.message?.contains("Kuantitas") == true)
    }

    @Test
    fun testIssueValidation_AcceptsValidTransaction() = runBlocking {
        val valid = IssueTransaction(
            localId = "1",
            warehouseId = "WH-CONT-HE",
            siteId = "SITE-VALE-C",
            unitNumber = "DT-001",
            currentHmKm = 14250.5,
            mechanicName = "Agus Saputra",
            receiverName = "Agus Saputra",
            workOrderNumber = "WO-2026-0901",
            maintenanceType = "Corrective",
            priority = "HIGH",
            sparePartId = "FLT-001",
            qty = 2.0,
            evidencePhotoPath = null,
            latitude = -2.5321,
            longitude = 121.3542,
            timestamp = System.currentTimeMillis()
        )
        val res = useCase(valid)
        assertTrue(res.isSuccess)
        assertEquals("ISSUE-SUCCESS-001", res.getOrNull())
    }
}
