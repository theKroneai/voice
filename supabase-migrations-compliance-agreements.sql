-- Ejecutar en Supabase SQL Editor
-- Tabla de declaraciones de cumplimiento (TCPA / consentimiento de contactos)

CREATE TABLE IF NOT EXISTS compliance_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  country TEXT NOT NULL,
  website TEXT,
  contact_source TEXT NOT NULL,
  contact_source_other TEXT,
  consent_description TEXT NOT NULL,
  privacy_policy_url TEXT,
  opt_in_form_url TEXT,
  decl_consent_contacts BOOLEAN NOT NULL DEFAULT false,
  decl_laws BOOLEAN NOT NULL DEFAULT false,
  decl_opt_out BOOLEAN NOT NULL DEFAULT false,
  decl_responsibility BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  terms_version TEXT NOT NULL DEFAULT 'v1.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compliance_agreements_user_id_idx ON compliance_agreements (user_id);
CREATE INDEX IF NOT EXISTS compliance_agreements_created_at_idx ON compliance_agreements (created_at DESC);

ALTER TABLE compliance_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_agreements_insert_own" ON compliance_agreements;
CREATE POLICY "compliance_agreements_insert_own" ON compliance_agreements
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "compliance_agreements_select_own" ON compliance_agreements;
CREATE POLICY "compliance_agreements_select_own" ON compliance_agreements
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "compliance_agreements_select_admin" ON compliance_agreements;
CREATE POLICY "compliance_agreements_select_admin" ON compliance_agreements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.es_admin IS TRUE OR trim(lower(u.es_admin::text)) IN ('true', 't', '1'))
    )
  );
