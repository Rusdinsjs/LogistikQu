-- Migration 020: POS Mechanic Signature and Mandatory Receipt Tracking

ALTER TABLE issue_transactions
ADD COLUMN IF NOT EXISTS mechanic_signature_url TEXT,
ADD COLUMN IF NOT EXISTS signature_type VARCHAR(30) NOT NULL DEFAULT 'DIGITAL',
ADD COLUMN IF NOT EXISTS receipt_printed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS receipt_printed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS signed_receipt_photo_url TEXT;

COMMENT ON COLUMN issue_transactions.mechanic_signature_url IS 'Data URL / path foto tanda tangan digital mekanik di layar HP / touchscreen';
COMMENT ON COLUMN issue_transactions.signature_type IS 'Metode tanda tangan mekanik: DIGITAL (di layar) atau PHYSICAL (di struk fisik)';
COMMENT ON COLUMN issue_transactions.receipt_printed IS 'Flag penanda apakah struk pengeluaran telah dicetak oleh Admin Container';
COMMENT ON COLUMN issue_transactions.receipt_printed_at IS 'Waktu cetak struk pertama kali';
COMMENT ON COLUMN issue_transactions.signed_receipt_photo_url IS 'Foto fisik struk yang telah ditandatangani basah oleh mekanik';
