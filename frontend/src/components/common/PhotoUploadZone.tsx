import React, { useRef, useState } from 'react';
import {
  FolderOpen,
  Camera,
  Trash2,
  Eye,
  Link as LinkIcon,
  CheckCircle2,
  Image as ImageIcon,
  X,
  RefreshCw,
} from 'lucide-react';

interface PhotoUploadZoneProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  helperText?: string;
  placeholder?: string;
  maxDimension?: number;
  quality?: number;
}

export const PhotoUploadZone: React.FC<PhotoUploadZoneProps> = ({
  value,
  onChange,
  label = 'Foto Perangkat Fisik',
  helperText = 'Klik untuk memilih foto dari folder perangkat atau jepret langsung via kamera HP',
  placeholder = 'https://... atau data:image/...',
  maxDimension = 1024,
  quality = 0.82,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Resize and compress image file via HTML5 Canvas
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Format file tidak didukung. Harap pilih gambar (JPG, PNG, WebP, dll).');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = maxDimension;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            onChange(compressedDataUrl);
          } else {
            // Fallback to original data URL if canvas context fails
            onChange(e.target?.result as string);
          }
        } catch (err) {
          console.error('Failed to compress image:', err);
          onChange(e.target?.result as string);
        } finally {
          setIsProcessing(false);
        }
      };

      img.onerror = () => {
        setIsProcessing(false);
        alert('Gagal memproses file gambar.');
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      setIsProcessing(false);
      alert('Gagal membaca file gambar.');
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // Reset input value so re-selecting same file triggers onChange
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleApplyUrl = () => {
    if (urlDraft.trim()) {
      onChange(urlDraft.trim());
      setShowUrlInput(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Hidden inputs: One for folder/gallery browsing, one for direct camera shutter */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <label className="block text-slate-400 text-xs font-medium">{label}</label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
        >
          <LinkIcon className="w-3 h-3" />
          {showUrlInput ? 'Tutup Input Link' : 'Gunakan Link URL'}
        </button>
      </div>

      {/* Manual URL Input dropdown if toggled */}
      {showUrlInput && (
        <div className="flex items-center gap-2 p-2 bg-slate-900/90 border border-slate-700 rounded-lg">
          <input
            type="text"
            placeholder={placeholder}
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:border-cyan-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleApplyUrl}
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded transition"
          >
            Terapkan
          </button>
        </div>
      )}

      {/* When Photo is Available */}
      {value ? (
        <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-500/30 flex items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative group cursor-pointer" onClick={() => setShowPreviewModal(true)}>
              <img
                src={value}
                alt="Foto Perangkat"
                className="w-14 h-14 rounded-lg object-cover border border-cyan-500/50 shadow group-hover:scale-105 transition"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <Eye className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Foto Terpasang</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5 font-mono">
                {value.startsWith('data:image') ? 'Foto Terkompresi (Siap Simpan)' : value}
              </p>
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 mt-0.5"
              >
                <Eye className="w-3 h-3" /> Lihat Ukuran Penuh
              </button>
            </div>
          </div>

          {/* Quick Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Pilih foto lain dari folder"
            >
              <FolderOpen className="w-4 h-4 text-cyan-400" />
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Ambil foto ulang lewat kamera HP"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 transition"
              title="Hapus foto"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Empty State: Upload / Capture Zone */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative rounded-xl border-2 border-dashed p-4 transition text-center flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? 'border-cyan-400 bg-cyan-950/30'
              : 'border-slate-700 hover:border-cyan-500/60 bg-slate-900/40'
          }`}
        >
          {isProcessing ? (
            <div className="py-4 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
              <span className="text-xs text-slate-300">Mengompres & memproses foto...</span>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-cyan-400 shadow-inner">
                <ImageIcon className="w-5 h-5" />
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-200">
                  Pilih Foto dari Perangkat atau Ambil Gambar
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{helperText}</p>
              </div>

              {/* Dual Action Buttons */}
              <div className="grid grid-cols-2 gap-2 w-full pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-cyan-500/50 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <FolderOpen className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>Pilih Folder / File</span>
                </button>

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/40 hover:to-teal-600/40 border border-emerald-500/40 hover:border-emerald-400 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <Camera className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Ambil Kamera HP</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* FULL PREVIEW MODAL */}
      {showPreviewModal && value && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="relative max-w-2xl max-h-[90vh] flex flex-col items-center bg-slate-900 border border-slate-700 p-3 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-cyan-400" /> Preview Foto Fisik Perangkat
              </span>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={value}
              alt="Preview Penuh"
              className="max-h-[70vh] max-w-full object-contain rounded-lg border border-slate-800"
            />
          </div>
        </div>
      )}
    </div>
  );
};
