-- Módulo de Integraciones CRM - Krone Agent AI
-- Ejecutar en el SQL Editor de Supabase

-- Tabla principal de integraciones CRM por cuenta
CREATE TABLE IF NOT EXISTS crm_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crm_type TEXT NOT NULL, -- bitrix24, hubspot, gohighlevel, zoho, salesforce, pipedrive, monday, custom
  is_connected BOOLEAN NOT NULL DEFAULT FALSE,
  config JSONB, -- Aquí se almacenan api_keys, URLs, toggles, etc. (ver Frontend)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, crm_type)
);

ALTER TABLE crm_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_integrations_select_own" ON crm_integrations;
CREATE POLICY "crm_integrations_select_own" ON crm_integrations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "crm_integrations_upsert_own" ON crm_integrations;
CREATE POLICY "crm_integrations_upsert_own" ON crm_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "crm_integrations_update_own" ON crm_integrations;
CREATE POLICY "crm_integrations_update_own" ON crm_integrations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Nota de seguridad:
-- api_key, tokens y secretos se guardan dentro de config.
-- Idealmente deben almacenarse en Supabase Vault o encriptados
-- con pgcrypto (columna cifrada) en producción.

-- Historial de sincronizaciones CRM (para el front de "Sincronizaciones activas")
CREATE TABLE IF NOT EXISTS crm_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crm_type TEXT NOT NULL,
  event TEXT NOT NULL, -- ej: lead_importado, call_exported, webhook_received
  contact_name TEXT,
  result TEXT, -- texto corto: "✅", "Error", etc.
  status TEXT NOT NULL DEFAULT 'success', -- success, error
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_sync_logs_select_own" ON crm_sync_logs;
CREATE POLICY "crm_sync_logs_select_own" ON crm_sync_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Inserciones en crm_sync_logs normalmente vendrán desde n8n / backend
-- usando una service_role key (omni-acceso) o una función RPC SECURITY DEFINER.

-- Catálogo de integraciones CRM (admin decide cuáles mostrar y edita nombre/logo/badge)
CREATE TABLE IF NOT EXISTS crm_integration_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT,
  logo_url TEXT,
  badge TEXT,
  badge_color TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_integration_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_select_all" ON crm_integration_catalog;
CREATE POLICY "catalog_select_all" ON crm_integration_catalog FOR SELECT USING (true);

DROP POLICY IF EXISTS "catalog_admin_update" ON crm_integration_catalog;
CREATE POLICY "catalog_admin_update" ON crm_integration_catalog FOR UPDATE
  USING ((SELECT es_admin FROM users WHERE id = auth.uid()) = true)
  WITH CHECK ((SELECT es_admin FROM users WHERE id = auth.uid()) = true);

DROP POLICY IF EXISTS "catalog_admin_insert" ON crm_integration_catalog;
CREATE POLICY "catalog_admin_insert" ON crm_integration_catalog FOR INSERT
  WITH CHECK ((SELECT es_admin FROM users WHERE id = auth.uid()) = true);

-- Seed: integraciones por defecto (logos vía Clearbit; puedes cambiar logo_url desde Admin)
INSERT INTO crm_integration_catalog (crm_type, name, description, emoji, logo_url, badge, badge_color, sort_order, visible) VALUES
('bitrix24', 'Bitrix24', 'El CRM más popular en LATAM. Sincroniza leads, deals y actividades.', '🏢', 'https://img.logo.dev/bitrix24.com?token=TOKEN&size=128', 'Popular en LATAM', 'bg-emerald-500/15 text-emerald-300', 1, true),
('hubspot', 'HubSpot', 'CRM líder mundial. Sincroniza contactos, deals y actividades.', '🟠', 'https://img.logo.dev/hubspot.com?token=TOKEN&size=128', NULL, NULL, 2, true),
('gohighlevel', 'GoHighLevel', 'El favorito de las agencias en EE.UU. Sincroniza contactos y oportunidades.', '⚡', 'https://img.logo.dev/gohighlevel.com?token=TOKEN&size=128', 'Favorito Agencias', 'bg-fuchsia-500/15 text-fuchsia-300', 3, true),
('zoho', 'Zoho CRM', 'CRM flexible para negocios en LATAM. Sincroniza leads y contactos.', '🔵', 'https://img.logo.dev/zoho.com?token=TOKEN&size=128', 'Popular en LATAM', 'bg-sky-500/15 text-sky-300', 4, true),
('salesforce', 'Salesforce', 'CRM enterprise. Para equipos grandes.', '☁️', 'https://img.logo.dev/salesforce.com?token=TOKEN&size=128', 'Enterprise', 'bg-indigo-500/15 text-indigo-300', 5, true),
('pipedrive', 'Pipedrive', 'CRM para equipos de ventas. Simple y efectivo.', '🟢', 'https://img.logo.dev/pipedrive.com?token=TOKEN&size=128', NULL, NULL, 6, true),
('monday', 'Monday.com', 'Gestión de proyectos y CRM. Sincroniza tareas y contactos.', '🎯', 'https://img.logo.dev/monday.com?token=TOKEN&size=128', NULL, NULL, 7, true),
('custom', 'CRM Personalizado', 'Conecta cualquier CRM o sistema propio via webhook. Compatible con cualquier plataforma.', '🔧', NULL, 'Flexible', 'bg-amber-500/15 text-amber-300', 8, true)
ON CONFLICT (crm_type) DO NOTHING;

