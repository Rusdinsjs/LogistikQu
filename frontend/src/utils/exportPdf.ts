export interface PrintReportOptions {
  title: string;
  subtitle?: string;
  generatedBy?: string;
  columns: Array<{ header: string; key: string; format?: (val: any) => string }>;
  data: Record<string, any>[];
}

export function printOrExportPdf(options: PrintReportOptions) {
  const { title, subtitle, generatedBy, columns, data } = options;

  if (!data || data.length === 0) {
    alert('Tidak ada data untuk dicetak.');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up browser diblokir. Izinkan pop-up untuk mencetak dokumen PDF.');
    return;
  }

  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const tableHeaderHtml = columns
    .map(
      (c) =>
        `<th style="padding: 8px 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase;">${c.header}</th>`
    )
    .join('');

  const tableRowsHtml = data
    .map((row, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const cells = columns
        .map((c) => {
          const rawVal = row[c.key];
          const val = c.format ? c.format(rawVal) : rawVal ?? '-';
          return `<td style="padding: 6px 12px; border: 1px solid #e2e8f0; font-size: 11px;">${val}</td>`;
        })
        .join('');
      return `<tr style="background-color: ${bg};">${cells}</tr>`;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} - LogisticQu WMS</title>
  <style>
    @media print {
      @page { margin: 15mm; size: landscape; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 20px;
    }
    .header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .company { font-size: 16px; font-weight: 800; color: #0369a1; letter-spacing: 0.5px; }
    .title { font-size: 18px; font-weight: 700; margin: 4px 0 2px 0; color: #0f172a; }
    .subtitle { font-size: 12px; color: #64748b; margin: 0; }
    .meta { text-align: right; font-size: 11px; color: #64748b; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .footer {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .signature-box {
      width: 28%;
      text-align: center;
      border-top: 1px solid #94a3b8;
      padding-top: 8px;
      font-size: 11px;
      color: #475569;
    }
    .signature-space { height: 50px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">SJS-VIPO — MINING OPERATIONS</div>
      <div class="title">${title}</div>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
    </div>
    <div class="meta">
      <div><strong>Sistem:</strong> LogisticQu Enterprise WMS</div>
      <div><strong>Dicetak Pada:</strong> ${dateStr}</div>
      <div><strong>Oleh:</strong> ${generatedBy || 'Sistem Admin'}</div>
      <div><strong>Total Data:</strong> ${data.length} Baris</div>
    </div>
  </div>

  <table>
    <thead><tr>${tableHeaderHtml}</tr></thead>
    <tbody>${tableRowsHtml}</tbody>
  </table>

  <div class="footer">
    <div class="signature-box">
      <div class="signature-space"></div>
      <strong>Dibuat Oleh</strong><br>
      <span>Petugas / Admin Logistik</span>
    </div>
    <div class="signature-box">
      <div class="signature-space"></div>
      <strong>Diperiksa Oleh</strong><br>
      <span>Supervisor Pergudangan</span>
    </div>
    <div class="signature-box">
      <div class="signature-space"></div>
      <strong>Disetujui Oleh</strong><br>
      <span>Superintendent Logistik</span>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
