-- Logs de actividad (frontend). Ejecutar en Supabase SQL Editor.
-- Requiere public.current_user_is_admin() (supabase-migrations-users-rls-self.sql)

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  categoria TEXT NOT NULL,
  pagina TEXT,
  detalle JSONB,
  error_mensaje TEXT,
  error_stack TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_categoria_idx ON public.activity_logs (categoria);
CREATE INDEX IF NOT EXISTS activity_logs_user_id_idx ON public.activity_logs (user_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs_insert" ON public.activity_logs;
CREATE POLICY "activity_logs_insert" ON public.activity_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "activity_logs_select_admin" ON public.activity_logs;
CREATE POLICY "activity_logs_select_admin" ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (public.current_user_is_admin());
