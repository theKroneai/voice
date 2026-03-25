# n8n — Webhooks Stripe para recarga de créditos (Krone Agent AI)

Configura estos dos workflows en n8n. **La STRIPE_SECRET_KEY solo debe estar en n8n**, nunca en el frontend.

---

## 1. POST /webhook/create-checkout

**Propósito:** Crear una sesión de Stripe Checkout y devolver la URL para redirigir al usuario.

### Trigger
- Webhook: `POST /webhook/create-checkout`
- Método: POST

### Body esperado (JSON)
```json
{
  "user_id": "uuid-del-usuario",
  "amount": 50,
  "plan": "vendedor"
}
```
- `amount`: monto en USD (número entero o decimal).
- `plan`: `"prospectador"` | `"vendedor"` | `"cazador"`.

### Respuesta esperada
```json
{
  "checkout_url": "https://checkout.stripe.com/..."
}
```

### Lógica en n8n
1. Leer body: `user_id`, `amount`, `plan`.
2. Validar: `amount >= 20` (mínimo recarga).
3. HTTP Request a Stripe:
   - **URL:** `POST https://api.stripe.com/v1/checkout/sessions`
   - **Headers:**
     - `Authorization: Bearer {{ $env.STRIPE_SECRET_KEY }}`
     - `Content-Type: application/x-www-form-urlencoded`
   - **Body (form-urlencoded):**
     - `payment_method_types[0]`: `card`
     - `line_items[0][price_data][currency]`: `usd`
     - `line_items[0][price_data][product_data][name]`: `Recarga Krone Agent AI - ${{ amount }}`
     - `line_items[0][price_data][unit_amount]`: `{{ Math.round(amount * 100) }}` (centavos)
     - `line_items[0][quantity]`: `1`
     - `mode`: `payment`
     - `success_url`: `https://voice.kronecrm.com/credits?success=true&amount={{ amount }}&plan={{ plan }}` (ajustar dominio; el frontend usa amount y plan para el mensaje de éxito)
     - `cancel_url`: `https://voice.kronecrm.com/credits?cancelled=true`
     - `metadata[user_id]`: `{{ user_id }}`
     - `metadata[plan]`: `{{ plan }}`
     - `metadata[amount]`: `{{ amount }}`
4. De la respuesta de Stripe, tomar `url` de la sesión y responder al webhook con:
   `{ "checkout_url": "{{ url }}" }`.

---

## 2. POST /webhook/stripe-payment (Webhook de Stripe)

**Propósito:** Recibir el evento `checkout.session.completed`, verificar firma, acreditar minutos y saldo en Supabase y registrar en `credit_transactions`. Opcional: comisión 20% para referidor.

### Trigger
- Webhook: `POST /webhook/stripe-payment`
- Este URL debe configurarse en el Dashboard de Stripe como “Webhook endpoint” para el evento `checkout.session.completed`.

### Seguridad
- Verificar firma del webhook con `STRIPE_WEBHOOK_SECRET` (Stripe lo muestra al crear el endpoint).
- Si la firma no coincide, responder 400 y no procesar.

### Lógica cuando `event.type === 'checkout.session.completed'`
1. Extraer de la sesión (p. ej. `event.data.object`):
   - `metadata.user_id`
   - `metadata.plan`
   - `metadata.amount` (o calcular desde `amount_total`: ver abajo)
   - `amount_total` (en centavos)
2. **USD:** `monto_usd = amount_total / 100`
3. **Minutos según plan:**
   - prospectador: `minutos = monto_usd / 0.45`
   - vendedor: `minutos = monto_usd / 0.75`
   - cazador: `minutos = monto_usd / 0.90`
4. **Descuento por volumen (aplicar al acreditar):**
   - Si `monto_usd >= 500`: `minutos *= 1.10`
   - Si `monto_usd >= 200`: `minutos *= 1.05`
5. **Supabase — actualizar créditos (tabla `credits`):**
   - Tabla: **`credits`** (columnas: `user_id`, `minutos_voz`, `plan_voz`, `sms_disponibles`, `saldo_referidos_usd`).
   - Si ya existe fila para `user_id`:  
     `UPDATE credits SET minutos_voz = minutos_voz + nuevos_minutos WHERE user_id = metadata.user_id`
   - Si no existe fila:  
     `INSERT INTO credits (user_id, minutos_voz, plan_voz, sms_disponibles, saldo_referidos_usd) VALUES (metadata.user_id, nuevos_minutos, metadata.plan, 0, 0)`  
     o usar UPSERT si tu BD lo soporta (ON CONFLICT user_id DO UPDATE SET minutos_voz = credits.minutos_voz + nuevos_minutos, plan_voz = metadata.plan).
6. **Supabase — insertar transacción:**
   - Tabla: `credit_transactions`
   - Campos sugeridos: `user_id`, `tipo`: `"recarga"`, `monto_usd`, `descripcion`: `"Recarga Stripe"`, `minutos`: nuevos_minutos.
7. **Referidor (opcional):**
   - Si el usuario tiene referidor (tabla de referidos), calcular comisión 20% del monto (ej. `comision = monto_usd * 0.20`).
   - Acreditar al referido (saldo referidos o tabla que uses) e insertar en `credit_transactions` con `tipo`/`descripcion` indicando comisión por referido.

### Reintentos
- Si el webhook falla, Stripe puede reintentar. Configurar en n8n hasta 3 reintentos si es posible para evitar duplicar acreditaciones (usar idempotencia por `session.id` si hace falta).

### Variables de entorno en n8n
- `STRIPE_SECRET_KEY`: clave secreta de Stripe (sk_test_... o sk_live_...).
- `STRIPE_WEBHOOK_SECRET`: signing secret del endpoint de webhook en Stripe.
- Credenciales de Supabase (URL + service_role o anon según RLS) para actualizar `credits` y `credit_transactions`.

---

## Resumen de tablas Supabase (obligatorio)

- **credits:** `user_id`, `minutos_voz`, `plan_voz`, `sms_disponibles`, `saldo_referidos_usd`.  
  El frontend y el webhook deben usar **solo esta tabla** para el saldo de voz.
- **credit_transactions:** `user_id`, `tipo`, `monto_usd`, `descripcion`, `minutos`, etc.  
  Insertar una fila por cada recarga Stripe (`tipo`: `"recarga"`, `descripcion`: `"Recarga Stripe"`).
