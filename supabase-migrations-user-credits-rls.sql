-- RLS para user_credits: permite al usuario leer/actualizar/crear su propia fila (para selección de plan).
-- Ejecutar en el SQL Editor de Supabase si la selección de plan falla por permisos.

-- Asegurar constraint único para evitar duplicados (si ya existe, omitir esta línea)
-- ALTER TABLE user_credits ADD CONSTRAINT user_credits_user_id_key UNIQUE (user_id);

-- Habilitar RLS (si no está ya)
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Usuario solo ve su propia fila
DROP POLICY IF EXISTS "user_credits_select_own" ON user_credits;
CREATE POLICY "user_credits_select_own" ON user_credits
  FOR SELECT USING (auth.uid() = user_id);

-- Usuario puede actualizar su propia fila (cambiar plan, etc.)
DROP POLICY IF EXISTS "user_credits_update_own" ON user_credits;
CREATE POLICY "user_credits_update_own" ON user_credits
  FOR UPDATE USING (auth.uid() = user_id);

-- Usuario puede insertar su propia fila (primera vez, al elegir plan)
DROP POLICY IF EXISTS "user_credits_insert_own" ON user_credits;
CREATE POLICY "user_credits_insert_own" ON user_credits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
