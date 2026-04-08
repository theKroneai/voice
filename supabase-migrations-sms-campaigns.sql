-- Ejecutar en Supabase SQL Editor
-- Campañas SMS masivas + contactos asociados

CREATE TABLE IF NOT EXISTS sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  variables_usadas JSONB DEFAULT '[]'::jsonb,
  total_contactos INTEGER NOT NULL DEFAULT 0,
  total_enviados INTEGER NOT NULL DEFAULT 0,
  total_respondidos INTEGER NOT NULL DEFAULT 0,
  costo_total_usd NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  programado_para TIMESTAMPTZ,
  completado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  contact_source TEXT DEFAULT 'all',
  voice_campaign_id UUID REFERENCES public.campaigns (id) ON DELETE SET NULL,
  enviar_ahora BOOLEAN NOT NULL DEFAULT true,
  es_seguimiento BOOLEAN NOT NULL DEFAULT false,
  seguimiento_config JSONB
);

CREATE INDEX IF NOT EXISTS sms_campaigns_user_id_idx ON sms_campaigns (user_id);
CREATE INDEX IF NOT EXISTS sms_campaigns_status_idx ON sms_campaigns (status);
CREATE INDEX IF NOT EXISTS sms_campaigns_created_at_idx ON sms_campaigns (created_at DESC);

ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_campaigns_select_own" ON sms_campaigns;
CREATE POLICY "sms_campaigns_select_own" ON sms_campaigns
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sms_campaigns_insert_own" ON sms_campaigns;
CREATE POLICY "sms_campaigns_insert_own" ON sms_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sms_campaigns_update_own" ON sms_campaigns;
CREATE POLICY "sms_campaigns_update_own" ON sms_campaigns
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sms_campaigns_delete_own" ON sms_campaigns;
CREATE POLICY "sms_campaigns_delete_own" ON sms_campaigns
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS sms_campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES sms_campaigns (id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts (id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre TEXT,
  telefono TEXT NOT NULL,
  mensaje_personalizado TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  enviado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_campaign_contacts_campaign_id_idx ON sms_campaign_contacts (campaign_id);
CREATE INDEX IF NOT EXISTS sms_campaign_contacts_user_id_idx ON sms_campaign_contacts (user_id);
CREATE INDEX IF NOT EXISTS sms_campaign_contacts_status_idx ON sms_campaign_contacts (status);

ALTER TABLE sms_campaign_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_campaign_contacts_select_own" ON sms_campaign_contacts;
CREATE POLICY "sms_campaign_contacts_select_own" ON sms_campaign_contacts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sms_campaign_contacts_insert_own" ON sms_campaign_contacts;
CREATE POLICY "sms_campaign_contacts_insert_own" ON sms_campaign_contacts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sms_campaign_contacts_update_own" ON sms_campaign_contacts;
CREATE POLICY "sms_campaign_contacts_update_own" ON sms_campaign_contacts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sms_campaign_contacts_delete_own" ON sms_campaign_contacts;
CREATE POLICY "sms_campaign_contacts_delete_own" ON sms_campaign_contacts
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
