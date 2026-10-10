-- Migration 004: User Profile Fields (Avatar, Email, Phone)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

-- Update default demo users with initial avatars & emails
UPDATE users SET
    email = 'budi.santoso@vale.com',
    phone = '0811-4000-001',
    avatar_url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
WHERE username = 'superadmin';

UPDATE users SET
    email = 'bambang.irawan@vale.com',
    phone = '0811-4000-002',
    avatar_url = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
WHERE username = 'manager';

UPDATE users SET
    email = 'hendra.gunawan@vale.com',
    phone = '0811-4000-003',
    avatar_url = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
WHERE username = 'supervisor_he';

UPDATE users SET
    email = 'dedi.kusnadi@vale.com',
    phone = '0811-4000-004',
    avatar_url = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'
WHERE username = 'supervisor_dt';
