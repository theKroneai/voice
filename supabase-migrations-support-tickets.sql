-- Tickets desde HelpChat (ejecutar en Supabase SQL Editor)
-- Requiere public.current_user_is_admin() (ver supabase-migrations-users-rls-self.sql)

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  descripcion TEXT NOT NULL,
  pagina TEXT,
  status TEXT DEFAULT 'pendiente',
  respuesta_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_insert" ON public.support_tickets;
CREATE POLICY "support_tickets_insert" ON public.support_tickets
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "support_tickets_select_own" ON public.support_tickets;
CREATE POLICY "support_tickets_select_own" ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "support_tickets_admin_all" ON public.support_tickets;
CREATE POLICY "support_tickets_admin_all" ON public.support_tickets
  FOR ALL
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());
