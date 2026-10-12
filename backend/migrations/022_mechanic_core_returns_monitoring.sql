-- Migration 022: Grant returns.view to MECHANIC role for Core Return monitoring (BR-004)
-- Memungkinkan mekanik melihat tanggungan pengembalian komponen bekas miliknya di Web dan Android
INSERT INTO role_permissions (role_id, permission_id) VALUES
('MECHANIC', 'returns.view')
ON CONFLICT DO NOTHING;
