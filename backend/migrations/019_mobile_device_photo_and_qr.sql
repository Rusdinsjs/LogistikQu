-- Migration 019: Mobile Device Photo & QR Code Enhancement
ALTER TABLE mobile_devices
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- Initialize default QR Code format for existing seeded devices
UPDATE mobile_devices
SET qr_code = 'DEVICE:' || device_id
WHERE qr_code IS NULL;
