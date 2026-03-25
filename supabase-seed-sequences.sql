-- Secuencias predefinidas para Krone Agent AI
-- Ejecutar en el SQL Editor de Supabase (una vez)
-- user_id de sistema: d8c0934e-4579-41c7-89bc-614c51d84218

-- 1. Seguimiento Agua: Sin Respuesta
INSERT INTO sequences (id, user_id, nombre, nicho, descripcion, es_publica, created_at)
SELECT gen_random_uuid(), 'd8c0934e-4579-41c7-89bc-614c51d84218', 'Seguimiento Agua: Sin Respuesta', 'agua',
  'Seguimiento para contactos que no respondieron. Día 0 SMS, Día 3 llamada, Día 7 SMS con contaminante.', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM sequences WHERE user_id = 'd8c0934e-4579-41c7-89bc-614c51d84218' AND nombre = 'Seguimiento Agua: Sin Respuesta');

DO $$
DECLARE
  seq_id UUID;
  steps_exist INT;
BEGIN
  SELECT id INTO seq_id FROM sequences
  WHERE user_id = 'd8c0934e-4579-41c7-89bc-614c51d84218' AND nombre = 'Seguimiento Agua: Sin Respuesta' LIMIT 1;
  IF seq_id IS NOT NULL THEN
    SELECT COUNT(*) INTO steps_exist FROM sequence_steps WHERE sequence_id = seq_id;
    IF steps_exist = 0 THEN
      INSERT INTO sequence_steps (sequence_id, orden, dia, canal, mensaje, hora_envio, activo)
      VALUES
        (seq_id, 1, 0, 'sms', 'Hola {nombre}, pasé por su casa en {ciudad} pero no logré encontrarlo. Tengo información importante sobre la calidad del agua en su zona. ¿Cuándo podemos conversar?', '09:00', true),
        (seq_id, 2, 3, 'call', 'Llamada de seguimiento automática', '09:00', true),
        (seq_id, 3, 7, 'sms', 'Hola {nombre}, le escribo porque los reportes federales detectaron {contaminante_1} en el agua de {zipcode}. ¿Le gustaría saber cómo proteger a su familia? Es gratis y sin compromiso.', '09:00', true);
    END IF;
  END IF;
END $$;

-- 2. Seguimiento Agua: Negociación Cromo-6
INSERT INTO sequences (id, user_id, nombre, nicho, descripcion, es_publica, created_at)
SELECT gen_random_uuid(), 'd8c0934e-4579-41c7-89bc-614c51d84218', 'Seguimiento Agua: Negociación Cromo-6', 'agua',
  'Secuencia de seguimiento con reporte EWG y cierre. Múltiples touchpoints SMS y llamada.', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM sequences WHERE user_id = 'd8c0934e-4579-41c7-89bc-614c51d84218' AND nombre = 'Seguimiento Agua: Negociación Cromo-6');

DO $$
DECLARE
  seq_id UUID;
  steps_exist INT;
BEGIN
  SELECT id INTO seq_id FROM sequences
  WHERE user_id = 'd8c0934e-4579-41c7-89bc-614c51d84218' AND nombre = 'Seguimiento Agua: Negociación Cromo-6' LIMIT 1;
  IF seq_id IS NOT NULL THEN
    SELECT COUNT(*) INTO steps_exist FROM sequence_steps WHERE sequence_id = seq_id;
    IF steps_exist = 0 THEN
      INSERT INTO sequence_steps (sequence_id, orden, dia, canal, mensaje, hora_envio, activo)
      VALUES
        (seq_id, 1, 0, 'sms', 'Fue un gusto hablar con usted {nombre}. Le dejo el reporte oficial del agua en {ciudad}: ewg.org/tapwater — Revíselo con calma.', '09:00', true),
        (seq_id, 2, 1, 'sms', '¿Pudo revisar el reporte? En {zipcode} detectaron {contaminante_1}, un contaminante sin olor ni sabor. ¿Qué le pareció?', '09:00', true),
        (seq_id, 3, 3, 'sms', 'Esta semana instalamos sistemas en {ciudad}. Sus vecinos ya tienen paz mental. ¿Le gustaría revisar opciones?', '09:00', true),
        (seq_id, 4, 5, 'call', 'Llamada de seguimiento', '09:00', true),
        (seq_id, 5, 7, 'sms', 'Esta oferta especial en {ciudad} vence pronto. ¿Le agendamos una visita sin compromiso?', '09:00', true),
        (seq_id, 6, 14, 'sms', 'Entendemos que no es el momento {nombre}. Cuando esté listo, aquí estaremos. Cuídese mucho.', '09:00', true);
    END IF;
  END IF;
END $$;

-- 3. Confirmación de Cita
INSERT INTO sequences (id, user_id, nombre, nicho, descripcion, es_publica, created_at)
SELECT gen_random_uuid(), 'd8c0934e-4579-41c7-89bc-614c51d84218', 'Confirmación de Cita', 'todos',
  'Recordatorio día antes y el mismo día de la cita. Usa variable {hora}.', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM sequences WHERE user_id = 'd8c0934e-4579-41c7-89bc-614c51d84218' AND nombre = 'Confirmación de Cita');

DO $$
DECLARE
  seq_id UUID;
  steps_exist INT;
BEGIN
  SELECT id INTO seq_id FROM sequences
  WHERE user_id = 'd8c0934e-4579-41c7-89bc-614c51d84218' AND nombre = 'Confirmación de Cita' LIMIT 1;
  IF seq_id IS NOT NULL THEN
    SELECT COUNT(*) INTO steps_exist FROM sequence_steps WHERE sequence_id = seq_id;
    IF steps_exist = 0 THEN
      INSERT INTO sequence_steps (sequence_id, orden, dia, canal, mensaje, hora_envio, activo)
      VALUES
        (seq_id, 1, -1, 'sms', 'Le confirmo nuestra cita para mañana a las {hora} en {ciudad}. ¿Sigue en pie? 👍', '09:00', true),
        (seq_id, 2, 0, 'sms', 'Le recuerdo que nos vemos hoy a las {hora}. Estoy en camino. Cualquier cambio avíseme.', '09:00', true);
    END IF;
  END IF;
END $$;

-- 4. Reactivación 90 días
INSERT INTO sequences (id, user_id, nombre, nicho, descripcion, es_publica, created_at)
SELECT gen_random_uuid(), 'd8c0934e-4579-41c7-89bc-614c51d84218', 'Reactivación 90 días', 'agua',
  'Un solo touch para reactivar contactos con los que se habló hace meses.', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM sequences WHERE user_id = 'd8c0934e-4579-41c7-89bc-614c51d84218' AND nombre = 'Reactivación 90 días');

DO $$
DECLARE
  seq_id UUID;
  steps_exist INT;
BEGIN
  SELECT id INTO seq_id FROM sequences
  WHERE user_id = 'd8c0934e-4579-41c7-89bc-614c51d84218' AND nombre = 'Reactivación 90 días' LIMIT 1;
  IF seq_id IS NOT NULL THEN
    SELECT COUNT(*) INTO steps_exist FROM sequence_steps WHERE sequence_id = seq_id;
    IF steps_exist = 0 THEN
      INSERT INTO sequence_steps (sequence_id, orden, dia, canal, mensaje, hora_envio, activo)
      VALUES
        (seq_id, 1, 0, 'sms', 'Hola {nombre}, hace unos meses hablamos sobre el agua en {ciudad}. Los niveles de {contaminante_1} siguen siendo una preocupación. ¿Le gustaría que revisemos opciones?', '09:00', true);
    END IF;
  END IF;
END $$;
