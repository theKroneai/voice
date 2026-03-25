-- Módulo de Referidos - Krone Agent AI
-- Ejecutar en el SQL Editor de Supabase

-- 1. Columnas en users
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id);

-- 2. Columna en user_credits (saldo ganado por referidos)
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS saldo_referidos_usd NUMERIC DEFAULT 0;

-- 3. Tabla referrals
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id)
);

-- 4. Tabla referral_transactions (comisiones por consumo)
CREATE TABLE IF NOT EXISTS referral_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consumo_minutos NUMERIC NOT NULL DEFAULT 0,
  consumo_usd NUMERIC NOT NULL DEFAULT 0,
  comision_usd NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acreditado')),
  acreditado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referral_transactions_referrer ON referral_transactions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_transactions_created ON referral_transactions(created_at DESC);

-- RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven sus referidos" ON referrals;
CREATE POLICY "Usuarios ven sus referidos" ON referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Sistema inserta referrals" ON referrals;
CREATE POLICY "Sistema inserta referrals" ON referrals FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios ven sus transacciones" ON referral_transactions;
CREATE POLICY "Usuarios ven sus transacciones" ON referral_transactions FOR SELECT
  USING (auth.uid() = referrer_id);

-- 5. Función para generar código de referido único
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid TEXT;
  base TEXT;
  new_code TEXT;
  exists_check BOOLEAN;
BEGIN
  uid := auth.uid()::TEXT;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  base := 'KRONE-' || UPPER(SUBSTRING(REPLACE(uid, '-', '') FROM 1 FOR 6));
  new_code := base;
  FOR i IN 1..10 LOOP
    SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = new_code AND id::TEXT <> uid) INTO exists_check;
    IF NOT exists_check THEN
      UPDATE users SET referral_code = new_code WHERE id = uid::UUID;
      RETURN new_code;
    END IF;
    new_code := base || i::TEXT;
  END LOOP;
  new_code := 'KRONE-' || UPPER(SUBSTRING(MD5(uid || NOW()::TEXT) FROM 1 FOR 6));
  UPDATE users SET referral_code = new_code WHERE id = uid::UUID;
  RETURN new_code;
END;
$$;

-- 6. RPC para acreditar comisiones pendientes (llamar desde n8n cada hora)
CREATE OR REPLACE FUNCTION acreditar_comisiones_pendientes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  acreditados INT := 0;
BEGIN
  FOR r IN
    SELECT rt.id, rt.referrer_id, rt.comision_usd
    FROM referral_transactions rt
    WHERE rt.status = 'pending'
    AND rt.created_at <= NOW() - INTERVAL '48 hours'
  LOOP
    UPDATE referral_transactions
    SET status = 'acreditado', acreditado_at = NOW()
    WHERE id = r.id;
    INSERT INTO user_credits (user_id, minutos_disponibles, sms_disponibles, saldo_referidos_usd)
    VALUES (r.referrer_id, 0, 0, r.comision_usd)
    ON CONFLICT (user_id) DO UPDATE SET
      saldo_referidos_usd = user_credits.saldo_referidos_usd + r.comision_usd;
    acreditados := acreditados + 1;
  END LOOP;
  RETURN jsonb_build_object('acreditados', acreditados);
END;
$$;

-- 7. RPC: lista de referidos con datos del referido (email, totales)
CREATE OR REPLACE FUNCTION get_my_referrals_with_details()
RETURNS TABLE (
  id UUID,
  referred_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  referred_email TEXT,
  referred_company TEXT,
  total_consumo_usd NUMERIC,
  total_comision_usd NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.referred_id, r.status, r.created_at,
         u.email AS referred_email, u.company_name AS referred_company,
         COALESCE(SUM(rt.consumo_usd), 0)::NUMERIC AS total_consumo_usd,
         COALESCE(SUM(rt.comision_usd), 0)::NUMERIC AS total_comision_usd
  FROM referrals r
  LEFT JOIN users u ON u.id = r.referred_id
  LEFT JOIN referral_transactions rt ON rt.referral_id = r.id
  WHERE r.referrer_id = auth.uid()
  GROUP BY r.id, r.referred_id, r.status, r.created_at, u.email, u.company_name
  ORDER BY r.created_at DESC;
$$;

-- 8. RPC: historial de comisiones con nombre del referido
CREATE OR REPLACE FUNCTION get_my_referral_transactions()
RETURNS TABLE (
  id UUID,
  referral_id UUID,
  referred_id UUID,
  consumo_minutos NUMERIC,
  consumo_usd NUMERIC,
  comision_usd NUMERIC,
  status TEXT,
  acreditado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  referred_email TEXT,
  referred_company TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rt.id, rt.referral_id, rt.referred_id, rt.consumo_minutos, rt.consumo_usd, rt.comision_usd,
         rt.status, rt.acreditado_at, rt.created_at,
         u.email AS referred_email, u.company_name AS referred_company
  FROM referral_transactions rt
  LEFT JOIN users u ON u.id = rt.referred_id
  WHERE rt.referrer_id = auth.uid()
  ORDER BY rt.created_at DESC;
$$;

-- Nota: El trigger o job que crea referral_transactions cuando un referido consume
-- debe implementarse en n8n o en tu backend. Esta migración solo define tablas y RPC.
-- Para probar: INSERT manual en referral_transactions y luego SELECT acreditar_comisiones_pendientes();

-- ========== n8n: Workflow "Acreditar Comisiones Referidos" ==========
-- 1. Schedule: cada hora (Cron: 0 * * * *)
-- 2. Nodo HTTP Request:
--    Method: POST
--    URL: https://<TU_PROYECTO>.supabase.co/rest/v1/rpc/acreditar_comisiones_pendientes
--    Headers:
--      apikey: <VITE_SUPABASE_ANON_KEY o service_role key>
--      Authorization: Bearer <mismo key>
--      Content-Type: application/json
-- 3. Log resultado en console (el RPC devuelve { "acreditados": N })
