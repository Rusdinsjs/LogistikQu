-- Migration 017: Stock Photos and QR Code Enhancement

-- 1. Add photo_url to spare_parts and inventory_stock
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. Ensure QR codes are set for all spare parts
UPDATE spare_parts
SET qr_code = CONCAT('QR-PART-', id)
WHERE qr_code IS NULL OR qr_code = '';

-- 3. Populate initial realistic stock photos for seed spare parts
UPDATE spare_parts
SET photo_url = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=500&auto=format&fit=crop&q=80'
WHERE id = 'FLT-001' AND (photo_url IS NULL OR photo_url = '');

UPDATE spare_parts
SET photo_url = 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=80'
WHERE id = 'FLT-002' AND (photo_url IS NULL OR photo_url = '');

UPDATE spare_parts
SET photo_url = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=500&auto=format&fit=crop&q=80'
WHERE id = 'FLT-003' AND (photo_url IS NULL OR photo_url = '');

UPDATE spare_parts
SET photo_url = 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=500&auto=format&fit=crop&q=80'
WHERE id = 'BRK-001' AND (photo_url IS NULL OR photo_url = '');

UPDATE spare_parts
SET photo_url = 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=500&auto=format&fit=crop&q=80'
WHERE id = 'BRK-002' AND (photo_url IS NULL OR photo_url = '');

UPDATE spare_parts
SET photo_url = 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=80'
WHERE id = 'HOS-001' AND (photo_url IS NULL OR photo_url = '');

UPDATE spare_parts
SET photo_url = 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=80'
WHERE id = 'HOS-002' AND (photo_url IS NULL OR photo_url = '');

UPDATE spare_parts
SET photo_url = 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=500&auto=format&fit=crop&q=80'
WHERE id = 'ENG-001' AND (photo_url IS NULL OR photo_url = '');

UPDATE spare_parts
SET photo_url = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80'
WHERE id = 'LUB-001' AND (photo_url IS NULL OR photo_url = '');

UPDATE spare_parts
SET photo_url = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80'
WHERE id = 'LUB-002' AND (photo_url IS NULL OR photo_url = '');

-- Synchronize photo_url to inventory_stock if not explicitly set
UPDATE inventory_stock s
SET photo_url = p.photo_url
FROM spare_parts p
WHERE s.spare_part_id = p.id AND (s.photo_url IS NULL OR s.photo_url = '') AND p.photo_url IS NOT NULL;
