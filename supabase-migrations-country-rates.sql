-- Tabla de tarifas por país para Krone Agent AI
-- Ejecutar en el SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS country_rates (
  codigo_pais TEXT PRIMARY KEY,
  nombre_pais TEXT NOT NULL,
  bandera TEXT,
  prefijo TEXT NOT NULL,
  costo_minuto_usd NUMERIC NOT NULL DEFAULT 0,
  precio_prospectador NUMERIC NOT NULL DEFAULT 0,
  precio_vendedor NUMERIC NOT NULL DEFAULT 0,
  precio_cazador NUMERIC NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO country_rates (
  codigo_pais, nombre_pais, bandera, prefijo,
  costo_minuto_usd, precio_prospectador, precio_vendedor, precio_cazador,
  activo
) VALUES
-- América del Norte
('US', 'Estados Unidos',       '🇺🇸', '+1',   0.012, 0.45, 0.75, 0.90, true),
('CA', 'Canadá',               '🇨🇦', '+1',   0.012, 0.45, 0.75, 0.90, true),
('MX', 'México',               '🇲🇽', '+52',  0.000, 0.00, 0.00, 0.00, false),

-- Centroamérica
('GT', 'Guatemala',            '🇬🇹', '+502', 0.000, 0.00, 0.00, 0.00, false),
('SV', 'El Salvador',          '🇸🇻', '+503', 0.000, 0.00, 0.00, 0.00, false),
('HN', 'Honduras',             '🇭🇳', '+504', 0.000, 0.00, 0.00, 0.00, false),
('NI', 'Nicaragua',            '🇳🇮', '+505', 0.000, 0.00, 0.00, 0.00, false),
('CR', 'Costa Rica',           '🇨🇷', '+506', 0.000, 0.00, 0.00, 0.00, false),
('PA', 'Panamá',               '🇵🇦', '+507', 0.000, 0.00, 0.00, 0.00, false),

-- El Caribe
('CU', 'Cuba',                 '🇨🇺', '+53',  0.000, 0.00, 0.00, 0.00, false),
('DO', 'Rep. Dominicana',      '🇩🇴', '+1',   0.000, 0.00, 0.00, 0.00, false),
('PR', 'Puerto Rico',          '🇵🇷', '+1',   0.000, 0.00, 0.00, 0.00, false),
('HT', 'Haití',                '🇭🇹', '+509', 0.000, 0.00, 0.00, 0.00, false),
('JM', 'Jamaica',              '🇯🇲', '+1',   0.000, 0.00, 0.00, 0.00, false),

-- América del Sur
('CO', 'Colombia',             '🇨🇴', '+57',  0.000, 0.00, 0.00, 0.00, false),
('VE', 'Venezuela',            '🇻🇪', '+58',  0.000, 0.00, 0.00, 0.00, false),
('EC', 'Ecuador',              '🇪🇨', '+593', 0.000, 0.00, 0.00, 0.00, false),
('PE', 'Perú',                 '🇵🇪', '+51',  0.000, 0.00, 0.00, 0.00, false),
('BO', 'Bolivia',              '🇧🇴', '+591', 0.000, 0.00, 0.00, 0.00, false),
('BR', 'Brasil',               '🇧🇷', '+55',  0.000, 0.00, 0.00, 0.00, false),
('PY', 'Paraguay',             '🇵🇾', '+595', 0.000, 0.00, 0.00, 0.00, false),
('UY', 'Uruguay',              '🇺🇾', '+598', 0.000, 0.00, 0.00, 0.00, false),
('AR', 'Argentina',            '🇦🇷', '+54',  0.000, 0.00, 0.00, 0.00, false),
('CL', 'Chile',                '🇨🇱', '+56',  0.000, 0.00, 0.00, 0.00, false),
('GY', 'Guyana',               '🇬🇾', '+592', 0.000, 0.00, 0.00, 0.00, false),
('SR', 'Surinam',              '🇸🇷', '+597', 0.000, 0.00, 0.00, 0.00, false),

-- España
('ES', 'España',               '🇪🇸', '+34',  0.000, 0.00, 0.00, 0.00, false)
ON CONFLICT (codigo_pais) DO NOTHING;
