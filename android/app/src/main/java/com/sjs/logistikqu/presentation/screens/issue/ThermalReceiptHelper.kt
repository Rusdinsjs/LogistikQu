package com.sjs.logistikqu.presentation.screens.issue

import android.content.Context
import android.content.Intent
import java.io.ByteArrayOutputStream
import java.nio.charset.Charset
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class ThermalReceiptData(
    val issueNumber: String,
    val warehouseId: String,
    val timestamp: Long = System.currentTimeMillis(),
    val unitNumber: String,
    val hmKm: Double,
    val workOrderNumber: String,
    val mechanicName: String,
    val receiverName: String,
    val partNumber: String,
    val partName: String,
    val quantity: Double,
    val binLocation: String = "BIN-A1-01",
    val isDigitallySigned: Boolean = true,
    val requiresCoreReturn: Boolean = false
)

object ThermalReceiptHelper {

    private val dateFormatter = SimpleDateFormat("dd-MM-yyyy HH:mm:ss", Locale.getDefault())

    /**
     * Format formatted string for 58mm thermal printers (32 columns)
     */
    fun formatSlipText(data: ThermalReceiptData): String {
        val dateStr = dateFormatter.format(Date(data.timestamp))
        val sb = StringBuilder()

        sb.appendLine("================================")
        sb.appendLine("      LOGISTIKQU SJS-VIPO       ")
        sb.appendLine("  BUKTI SERAH TERIMA SUKU CADANG")
        sb.appendLine("================================")
        sb.appendLine("Lokasi  : ${data.warehouseId}")
        sb.appendLine("No Issue: ${data.issueNumber}")
        sb.appendLine("Waktu   : $dateStr")
        sb.appendLine("--------------------------------")
        sb.appendLine("Unit    : ${data.unitNumber.padEnd(12)} HM/KM: ${data.hmKm}")
        sb.appendLine("No WO   : ${data.workOrderNumber}")
        sb.appendLine("Mekanik : ${data.mechanicName}")
        sb.appendLine("Penerima: ${data.receiverName}")
        sb.appendLine("--------------------------------")
        sb.appendLine("PART DIKELUARKAN:")
        sb.appendLine("${data.partNumber} - ${data.partName.take(20)}")
        sb.appendLine("Kuantitas : ${data.quantity} PCS")
        sb.appendLine("Lokasi Rak: ${data.binLocation}")
        sb.appendLine("--------------------------------")
        sb.appendLine("Status TTD: ${if (data.isDigitallySigned) "[ TERVERIFIKASI DIGITAL ]" else "[ TTD MANUAL ]"}")

        if (data.requiresCoreReturn) {
            sb.appendLine("--------------------------------")
            sb.appendLine("  *** PERINGATAN CORE RETURN ***")
            sb.appendLine("  KOMPONEN BEKAS WAJIB DISERAH- ")
            sb.appendLine("  KAN KE KONTAINER DALAM 24 JAM ")
            sb.appendLine("  SEBELUM WORK ORDER DITUTUP!   ")
        }

        sb.appendLine("================================")
        sb.appendLine(" Simpan struk ini sebagai bukti ")
        sb.appendLine(" serah terima resmi di lapangan ")
        sb.appendLine("================================")
        sb.appendLine("\n\n")

        return sb.toString()
    }

    /**
     * Generate ESC/POS raw command byte stream for Bluetooth Thermal Printers (58mm/80mm)
     */
    fun generateEscPosBytes(data: ThermalReceiptData): ByteArray {
        val out = ByteArrayOutputStream()
        val charset = Charset.forName("CP437")

        // 1. ESC @ (Initialize printer)
        out.write(byteArrayOf(0x1B, 0x40))

        // 2. ESC a 1 (Center align)
        out.write(byteArrayOf(0x1B, 0x61, 0x01))

        // 3. ESC ! 0x30 (Double width + Double height for Header)
        out.write(byteArrayOf(0x1B, 0x21, 0x30))
        out.write("LOGISTIKQU\n".toByteArray(charset))

        // 4. ESC ! 0x00 (Normal text)
        out.write(byteArrayOf(0x1B, 0x21, 0x00))
        out.write("PT SJS - VALE MINING LOGISTICS\n".toByteArray(charset))
        out.write("BUKTI PENGELUARAN LOKET\n".toByteArray(charset))
        out.write("================================\n".toByteArray(charset))

        // 5. ESC a 0 (Left align for body)
        out.write(byteArrayOf(0x1B, 0x61, 0x00))
        val bodyText = StringBuilder().apply {
            val dateStr = dateFormatter.format(Date(data.timestamp))
            appendLine("No Issue: ${data.issueNumber}")
            appendLine("Gudang  : ${data.warehouseId}")
            appendLine("Waktu   : $dateStr")
            appendLine("--------------------------------")
            appendLine("Unit    : ${data.unitNumber}")
            appendLine("HM/KM   : ${data.hmKm}")
            appendLine("No WO   : ${data.workOrderNumber}")
            appendLine("Mekanik : ${data.mechanicName}")
            appendLine("--------------------------------")
            appendLine("Part No : ${data.partNumber}")
            appendLine("Nama    : ${data.partName.take(22)}")
            appendLine("Qty     : ${data.quantity} PCS")
            appendLine("Rak Bin : ${data.binLocation}")
            appendLine("--------------------------------")
            appendLine("Otorisasi TTD: DIGITAL VERIFIED")
        }.toString()
        out.write(bodyText.toByteArray(charset))

        // 6. Warning Section if core return
        if (data.requiresCoreReturn) {
            out.write(byteArrayOf(0x1B, 0x61, 0x01)) // Center
            out.write(byteArrayOf(0x1B, 0x21, 0x08)) // Emphasized bold
            out.write("\n*** PERINGATAN BR-004 ***\nWAJIB CORE RETURN 24 JAM!\n\n".toByteArray(charset))
            out.write(byteArrayOf(0x1B, 0x21, 0x00)) // Normal
        }

        // 7. Footer
        out.write(byteArrayOf(0x1B, 0x61, 0x01))
        out.write("================================\n".toByteArray(charset))
        out.write("Struk Sah Logistik Lapangan\n\n\n\n".toByteArray(charset))

        // 8. GS V 66 0 (Cut paper)
        out.write(byteArrayOf(0x1D, 0x56, 0x42, 0x00))

        return out.toByteArray()
    }

    /**
     * Share receipt text to printer companion apps or messaging
     */
    fun shareReceipt(context: Context, data: ThermalReceiptData) {
        val slipText = formatSlipText(data)
        val sendIntent = Intent().apply {
            action = Intent.ACTION_SEND
            putExtra(Intent.EXTRA_TEXT, slipText)
            putExtra(Intent.EXTRA_SUBJECT, "Bukti Pengeluaran Part ${data.issueNumber}")
            type = "text/plain"
        }
        val shareIntent = Intent.createChooser(sendIntent, "Cetak / Bagikan Slip POS Issue")
        context.startActivity(shareIntent)
    }
}
