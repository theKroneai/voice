-- Migraciones para módulo Secuencias y Google Review
-- Ejecutar en el SQL Editor de Supabase

-- 1. Link de Google Review en users (para secuencias y Settings)
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_review_link TEXT;

-- 2. Variables extra por contact_sequence (google_review_link, hora, referido para n8n)
ALTER TABLE contact_sequences ADD COLUMN IF NOT EXISTS variables_extra JSONB;
