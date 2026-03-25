-- Ejecutar en el SQL Editor de Supabase
-- Soluciona 404 en user_credits y 400 en admin_config (columnas de precio)

-- 1. Tabla user_credits (si no existe)
CREATE TABLE IF NOT EXISTS user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'PRO' CHECK (plan IN ('BASICO', 'PRO', 'PREMIUM')),
  minutos_disponibles NUMERIC NOT NULL DEFAULT 0,
  sms_disponibles NUMERIC NOT NULL DEFAULT 0,
  saldo_referidos_usd NUMERIC DEFAULT 0
);

-- Si la tabla ya existía, asegurar columnas que falten
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'PRO';
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS minutos_disponibles NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS sms_disponibles NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS saldo_referidos_usd NUMERIC DEFAULT 0;

-- 2. Columnas de precio por minuto en admin_config (si no existen)
ALTER TABLE admin_config ADD COLUMN IF NOT EXISTS price_per_min_basico NUMERIC;
ALTER TABLE admin_config ADD COLUMN IF NOT EXISTS price_per_min_pro NUMERIC;
ALTER TABLE admin_config ADD COLUMN IF NOT EXISTS price_per_min_premium NUMERIC;

-- 3. RLS user_credits (cada usuario solo ve/modifica su fila)
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_credits_select_own" ON user_credits;
CREATE POLICY "user_credits_select_own" ON user_credits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_credits_update_own" ON user_credits;
CREATE POLICY "user_credits_update_own" ON user_credits
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_credits_insert_own" ON user_credits;
CREATE POLICY "user_credits_insert_own" ON user_credits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
