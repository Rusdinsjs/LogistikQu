-- Migration 014: Enterprise Notification Engine & Multi-Channel Alerting
-- LogistikQu Enterprise WMS Standard Phase 9 & Phase 10

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel VARCHAR(30) NOT NULL DEFAULT 'IN_APP';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_role VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(150);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(30) NOT NULL DEFAULT 'DELIVERED';

-- Backfill trigger_type from notification_type if null
UPDATE notifications SET trigger_type = notification_type WHERE trigger_type IS NULL;
ALTER TABLE notifications ALTER COLUMN trigger_type SET DEFAULT 'LOW_STOCK';

-- Backfill recipient_role from role_id if null
UPDATE notifications SET recipient_role = role_id WHERE recipient_role IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_trigger ON notifications (trigger_type);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications (channel);
CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read ON notifications (user_id, is_read);

-- Seed initial demonstration notifications
INSERT INTO notifications (
    user_id, recipient_role, role_id, recipient_email, recipient_phone,
    title, message, channel, trigger_type, notification_type, reference_id, metadata, is_read
) VALUES
(
    '00000000-0000-0000-0000-000000000001', 'SUPER_ADMIN', 'SUPER_ADMIN', 'budi.santoso@vale.com', '+628114000001',
    'Peringatan Stok Menipis (Low Stock)',
    'Suku cadang Hydraulic Return Filter (FLT-002) di WH-CONT-HE berada di angka 8 PCS (Batas Min: 10 PCS). Rekomendasi order segera: 42 PCS.',
    'IN_APP', 'LOW_STOCK', 'LOW_STOCK', 'FLT-002',
    '{"spare_part_id": "FLT-002", "warehouse_id": "WH-CONT-HE", "current_stock": 8, "min_stock": 10}',
    FALSE
),
(
    '00000000-0000-0000-0000-000000000003', 'SUPERVISOR_HE', 'SUPERVISOR_HE', 'supervisor.he@vale.com', '+628114000003',
    'Permohonan Persetujuan Baru (Approval Request)',
    'Permohonan pengadaan stok REQ-20261011-00001 dari WH-CONT-HE telah diverifikasi oleh Admin Utama dan menunggu persetujuan Anda.',
    'WHATSAPP', 'APPROVAL_REQUEST', 'APPROVAL_REQUEST', 'REQ-20261011-00001',
    '{"request_number": "REQ-20261011-00001", "container_warehouse_id": "WH-CONT-HE"}',
    FALSE
),
(
    '00000000-0000-0000-0000-000000000005', 'CONTAINER_ADMIN_HE', 'CONTAINER_ADMIN_HE', 'ahmad.dani@vale.com', '+628114000005',
    'Permohonan Disetujui & Drop STO Terbit',
    'Permohonan pengadaan REQ-20261011-00001 telah disetujui Supervisor. Dokumen Drop STO DROP-20261011-00001 telah terbit menuju kontainer.',
    'EMAIL', 'APPROVAL_COMPLETED', 'APPROVAL_COMPLETED', 'DROP-20261011-00001',
    '{"drop_number": "DROP-20261011-00001", "request_number": "REQ-20261011-00001"}',
    TRUE
),
(
    '00000000-0000-0000-0000-000000000001', 'SUPER_ADMIN', 'SUPER_ADMIN', 'budi.santoso@vale.com', '+628114000001',
    'Deteksi Konsumsi Abnormal (Abnormal Consumption)',
    'Terdeteksi pengeluaran 12 PCS Fan Belt Heavy Duty (ENG-001) untuk Unit DT-025 dalam satu transaksi. Angka ini melebihi 3x rata-rata konsumsi harian normal.',
    'IN_APP', 'ABNORMAL_CONSUMPTION', 'ABNORMAL_CONSUMPTION', 'ENG-001',
    '{"spare_part_id": "ENG-001", "unit_number": "DT-025", "issued_qty": 12, "threshold_qty": 3}',
    FALSE
),
(
    '00000000-0000-0000-0000-000000000005', 'CONTAINER_ADMIN_HE', 'CONTAINER_ADMIN_HE', 'ahmad.dani@vale.com', '+628114000005',
    'Transaksi Ditolak (Rejected Transaction)',
    'Permohonan pengeluaran darurat part rem BRK-001 untuk unit DT-009 ditolak oleh Supervisor karena catatan HM/KM tidak valid.',
    'IN_APP', 'REJECTED_TRANSACTION', 'REJECTED_TRANSACTION', 'ISS-REJ-001',
    '{"spare_part_id": "BRK-001", "unit_number": "DT-009", "reason": "HM/KM tidak valid"}',
    FALSE
)
ON CONFLICT DO NOTHING;
