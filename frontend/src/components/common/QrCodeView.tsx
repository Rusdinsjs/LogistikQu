import React, { useMemo, useState } from 'react';
import { generateQrSvg, generateQrSvgDataUri } from '../../utils/qrcode';
import { Download, Printer, Copy, Check, QrCode as QrIcon } from 'lucide-react';

interface QrCodeViewProps {
  value: string;
  size?: number;
  title?: string;
  subtitle?: string;
  partName?: string;
  warehouseName?: string;
  rackLocation?: string;
  showActions?: boolean;
}

export const QrCodeView: React.FC<QrCodeViewProps> = ({
  value,
  size = 180,
  title,
  subtitle,
  partName,
  warehouseName,
  rackLocation,
  showActions = true,
}) => {
  const [copied, setCopied] = useState(false);

  // Generate SVG string
  const svgString = useMemo(() => {
    return generateQrSvg(value || 'N/A', {
      size,
      margin: 2,
      fgColor: '#090d16',
      bgColor: '#ffffff',
      level: 'M',
    });
  }, [value, size]);

  const svgDataUri = useMemo(() => {
    return generateQrSvgDataUri(value || 'N/A', {
      size: 400,
      margin: 2,
      fgColor: '#090d16',
      bgColor: '#ffffff',
      level: 'M',
    });
  }, [value]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy QR code text:', err);
    }
  };

  const handleDownloadPng = () => {
    const canvas = document.createElement('canvas');
    const exportSize = 600;
    canvas.width = exportSize;
    canvas.height = exportSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Draw white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportSize, exportSize);
      ctx.drawImage(img, 0, 0, exportSize, exportSize);

      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      const safeFilename = (title || value).replace(/[^a-zA-Z0-9_-]/g, '_');
      downloadLink.download = `QR_${safeFilename}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };
    img.src = svgDataUri;
  };

  const handlePrintLabel = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=600');
    if (!printWindow) {
      alert('Pop-up window diblokir oleh browser. Izinkan pop-up untuk mencetak label.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Label QR - ${title || value}</title>
        <style>
          @page {
            size: 80mm 55mm;
            margin: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 8mm;
            background: #ffffff;
            color: #000000;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            height: 100vh;
          }
          .header {
            border-bottom: 2px solid #000;
            padding-bottom: 4px;
            margin-bottom: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .header .brand {
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .header .corp {
            font-size: 9px;
            font-weight: 600;
            color: #555;
          }
          .body {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .qr-img {
            width: 100px;
            height: 100px;
            flex-shrink: 0;
          }
          .info {
            flex: 1;
            overflow: hidden;
          }
          .part-no {
            font-family: monospace;
            font-size: 15px;
            font-weight: 900;
            margin-bottom: 2px;
            word-break: break-all;
          }
          .part-name {
            font-size: 11px;
            font-weight: 700;
            line-height: 1.25;
            margin-bottom: 6px;
            max-height: 28px;
            overflow: hidden;
          }
          .meta-row {
            font-size: 9px;
            color: #333;
            margin-bottom: 2px;
          }
          .bin-badge {
            display: inline-block;
            background: #000;
            color: #fff;
            padding: 2px 6px;
            font-size: 9px;
            font-weight: 800;
            font-family: monospace;
            border-radius: 3px;
            margin-top: 3px;
          }
          .footer {
            border-top: 1px dashed #777;
            padding-top: 4px;
            font-size: 8px;
            color: #666;
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">LogistikQu Part Tag</div>
          <div class="corp">PT VALE INDONESIA • SJS</div>
        </div>
        <div class="body">
          <img class="qr-img" src="${svgDataUri}" alt="QR" />
          <div class="info">
            <div class="part-no">${title || value}</div>
            <div class="part-name">${partName || subtitle || 'Suku Cadang'}</div>
            <div class="meta-row"><strong>Gudang:</strong> ${warehouseName || 'Gudang Kontainer'}</div>
            <div class="meta-row"><strong>Lokasi Bin:</strong> <span class="bin-badge">${rackLocation || 'STANDAR'}</span></div>
          </div>
        </div>
        <div class="footer">
          <span>QR Code: ${value}</span>
          <span>Dicetak: ${new Date().toLocaleDateString('id-ID')}</span>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col items-center">
      {/* QR Code Container */}
      <div className="p-3 bg-white rounded-2xl shadow-lg border border-slate-700/60 transition-transform duration-200 hover:scale-[1.02]">
        <div
          dangerouslySetInnerHTML={{ __html: svgString }}
          className="rounded-lg overflow-hidden flex items-center justify-center"
        />
      </div>

      {/* Code Text Label */}
      <div className="mt-2.5 flex items-center gap-1.5 px-3 py-1 bg-slate-900/90 border border-slate-800 rounded-lg max-w-full">
        <QrIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="font-mono text-xs font-bold text-slate-200 truncate select-all">{value}</span>
        <button
          onClick={handleCopy}
          className="p-1 hover:text-cyan-300 text-slate-400 transition"
          title="Salin Kode QR"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleDownloadPng}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition shadow-sm"
            title="Unduh file gambar QR Code PNG"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Unduh PNG</span>
          </button>
          <button
            onClick={handlePrintLabel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition shadow-sm shadow-cyan-500/20"
            title="Cetak label sticker QR Code untuk rak atau kemasan suku cadang"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Label</span>
          </button>
        </div>
      )}
    </div>
  );
};
