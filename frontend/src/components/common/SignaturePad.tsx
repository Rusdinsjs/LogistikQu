import React, { useRef, useState, useEffect, useCallback } from 'react';
import { RotateCcw, CheckCircle, AlertCircle, PenTool } from 'lucide-react';

export interface SignaturePadProps {
  value?: string | null;
  onChange: (signatureDataUrl: string | null) => void;
  signerName?: string;
  roleLabel?: string;
  disabled?: boolean;
  height?: number;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  value,
  onChange,
  signerName = 'Mekanik',
  roleLabel = 'Mekanik Penanggung Jawab',
  disabled = false,
  height = 150,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(Boolean(value));
  const [strokeCount, setStrokeCount] = useState(0);

  // Initialize canvas with proper DPI scaling
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width || 360;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#0f172a'; // Elegant dark ink color

    // If pre-existing signature provided, draw it
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
      };
      img.src = value;
      setHasSignature(true);
    }
  }, [height, value]);

  useEffect(() => {
    setupCanvas();
    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvas]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    if ('touches' in e) {
      // Prevent scrolling when drawing on touchscreen/smartphone
      e.stopPropagation();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    if ('touches' in e) {
      e.stopPropagation();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();

    if (!hasSignature) {
      setHasSignature(true);
    }
    setStrokeCount((prev) => prev + 1);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (strokeCount > 2 || hasSignature) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  };

  const clearSignature = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setStrokeCount(0);
    onChange(null);
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* Header Info */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-slate-300">
          <PenTool className="w-3.5 h-3.5 text-cyan-400" />
          <span>Tanda Tangan Digital di Layar HP / Touchscreen</span>
        </div>
        <div className="flex items-center gap-2">
          {hasSignature ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" />
              <span>Tanda Tangan Terekam</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" />
              <span>Wajib Ditandatangani</span>
            </span>
          )}
        </div>
      </div>

      {/* Signature Canvas Box */}
      <div className="relative rounded-xl border border-slate-700 bg-slate-100 overflow-hidden shadow-inner group">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
          style={{ touchAction: 'none' }}
          className={`w-full block cursor-crosshair select-none ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />

        {/* Signature Line & Name Guide */}
        <div className="absolute inset-x-4 bottom-3 pointer-events-none flex items-center justify-between border-t border-slate-400/50 pt-1 text-[10px] font-mono text-slate-500">
          <span className="font-sans font-semibold text-slate-700 truncate max-w-[200px]">
            {signerName} ({roleLabel})
          </span>
          <span className="text-[9px] uppercase tracking-wider text-slate-400 shrink-0">
            {hasSignature ? 'Digital Sign OK' : '✕ Goreskan Tanda Tangan'}
          </span>
        </div>

        {/* Quick Clear Floating Button */}
        {hasSignature && !disabled && (
          <button
            type="button"
            onClick={clearSignature}
            className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-900 text-slate-200 text-[10px] font-semibold flex items-center gap-1 shadow transition-colors backdrop-blur-sm"
            title="Bersihkan tanda tangan dan ulang"
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span>Ulangi</span>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
        <span>Gunakan ujung jari di smartphone atau kursor mouse di komputer</span>
        {hasSignature && (
          <button
            type="button"
            onClick={clearSignature}
            disabled={disabled}
            className="text-rose-400 hover:text-rose-300 font-semibold underline"
          >
            Bersihkan Canvas
          </button>
        )}
      </div>
    </div>
  );
};
