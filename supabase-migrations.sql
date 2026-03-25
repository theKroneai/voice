-- Ejecutar en el SQL Editor de Supabase

-- 1. Columna es_admin en users
ALTER TABLE users ADD COLUMN IF NOT EXISTS es_admin BOOLEAN DEFAULT FALSE;

-- 2. Tabla admin_config
CREATE TABLE IF NOT EXISTS admin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retell_api_key TEXT,
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_api_key TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla phone_numbers (números A2P)
CREATE TABLE IF NOT EXISTS phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT,
  asignado_a TEXT,
  rotacion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla call_logs (si no existe) para actividad global
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  contacto TEXT,
  duracion NUMERIC,
  estado TEXT,
  costo NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. user_credits: asegurar que existe constraint único en user_id para upsert
-- Si ya tienes user_credits, agrega: UNIQUE(user_id) si no lo tiene
-- ALTER TABLE user_credits ADD CONSTRAINT user_credits_user_id_key UNIQUE (user_id);

-- 6. Tabla plan_config (planes de precios)
CREATE TABLE IF NOT EXISTS plan_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  emoji TEXT,
  precio_por_minuto NUMERIC NOT NULL,
  descripcion TEXT,
  features JSONB,
  activo BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO plan_config (plan_id, nombre, emoji, precio_por_minuto, descripcion, features) VALUES
('prospectador', 'El Prospectador', '🎯', 0.45,
 'Lanza campañas outbound ilimitadas. Llama, hace seguimiento y reintenta hasta cerrar.',
 '["Solo Outbound", "Reintentos ilimitados", "Transcripciones", "Dashboard básico"]'),
('vendedor', 'El Vendedor', '⚡', 0.75,
 'Llama y también atiende. Tu negocio nunca pierde una llamada entrante ni una oportunidad.',
 '["Outbound + Inbound", "Reintentos ilimitados", "Transcripciones", "Dashboard completo", "Historial de llamadas"]'),
('cazador', 'El Cazador', '👑', 0.90,
 'El arsenal completo. Llama, atiende y si no contestan les llega un SMS automático.',
 '["Todo en El Vendedor", "SMS automático si no contesta", "SMS confirmación de cita", "Reportes avanzados"]')
ON CONFLICT (plan_id) DO NOTHING;

-- Plan SMS Outbound (precio por mensaje en precio_por_minuto)
INSERT INTO plan_config (plan_id, nombre, emoji, precio_por_minuto, descripcion, features)
VALUES (
  'sms',
  'SMS Outbound',
  '💬',
  0.05,
  'Paga solo por los mensajes que envías. Sin paquetes ni sorpresas.',
  '["SMS post-llamada automático", "Confirmación de cita", "Recordatorio 24h antes", "Respuestas monitoreadas"]'
)
ON CONFLICT (plan_id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  emoji = EXCLUDED.emoji,
  precio_por_minuto = EXCLUDED.precio_por_minuto,
  descripcion = EXCLUDED.descripcion,
  features = EXCLUDED.features,
  updated_at = now();

-- RLS plan_config
ALTER TABLE plan_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura pública" ON plan_config;
CREATE POLICY "Lectura pública" ON plan_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Solo admin puede editar" ON plan_config;
CREATE POLICY "Solo admin puede editar" ON plan_config FOR ALL
  USING (auth.uid() = 'd8c0934e-4579-41c7-89bc-614c51d84218');
