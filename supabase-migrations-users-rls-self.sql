-- Ejecutar en Supabase SQL Editor si el menú Admin no aparece aunque es_admin = true:
-- Suele ser RLS en public.users sin política para que cada usuario lea su propia fila.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Lectura de la propia fila (incluye es_admin para Sidebar / RequireAdmin)
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Onboarding y perfil
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Admins leen todas las filas (panel Admin). SECURITY DEFINER + row_security off evita recursión RLS.
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL row_security = off;
  RETURN COALESCE(
    (SELECT u.es_admin FROM public.users u WHERE u.id = auth.uid()),
    false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

DROP POLICY IF EXISTS "users_select_all_if_admin" ON public.users;
CREATE POLICY "users_select_all_if_admin" ON public.users
  FOR SELECT
  TO authenticated
  USING (public.current_user_is_admin());
