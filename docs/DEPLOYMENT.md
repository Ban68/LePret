# Despliegue a Producción (Vercel)

Este documento es una guía práctica para dejar la aplicación lista en producción usando Vercel, Supabase, Resend y PandaDoc.

## 0) Prerrequisitos
- Cuenta Vercel (proyecto creado y conectado al repo).
- Cuenta Supabase (instancia de producción separada del dev).
- Resend con dominio verificado (SPF/DKIM/DMARC publicados).
- PandaDoc con plantilla lista (UUID) y Webhook configurado.

## 1) Supabase (Producción)
1. Crea un proyecto “prod” y abre el SQL Editor.
2. Ejecuta una sola vez el esquema: `docs/supabase-schema.sql` (esto crea tablas, RLS y buckets requeridos).
3. Verifica tablas: `profiles, companies, memberships, invoices, funding_requests, offers, documents, audit_logs`.
4. Verifica buckets privados: `invoices, requests, kyc, contracts`.
5. Marca al menos un usuario staff global (operaciones):
   ```sql
   update public.profiles set is_staff = true where user_id in ('<UUID_USUARIO_STAFF>');
   ```
6. Copia URLs y claves (prod) para Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2) PandaDoc
- Plantilla (producción): guarda su UUID; ejemplo `YFJp93pEXnrZu5PuwVgSi4`.
- Rol del firmante en la plantilla: por ejemplo `Firmante` (debe coincidir exactamente en mayúsculas/minúsculas).
- Recomendado (por política de envío): dejar `PANDADOC_SEND=false` y usar correo por Resend + abrir manualmente en PandaDoc.
- Webhook en PandaDoc → Settings → Webhooks:
  - URL: `https://TU-DOMINIO.com/api/webhooks/pandadoc`
  - Evento: “El destinatario ha completado un documento” (o equivalente)
  - Secret/Signing key: valor largo y aleatorio (mismo que `PANDADOC_WEBHOOK_SECRET` en Vercel)

## 3) Resend (correo)
- Verifica el dominio remitente (ej. `lepretcapital.com`).
- Publica los registros DNS DKIM/SPF/DMARC (DMARC puede empezar con `p=none`).
- Obtén `RESEND_API_KEY` y define `EMAIL_FROM` con el dominio verificado (ej. `noreply@lepretcapital.com`).

## 4) Vercel – Variables de Entorno
En el proyecto de Vercel → Settings → Environment Variables (Production):

- Supabase
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- Resend
  - `RESEND_API_KEY`
  - `EMAIL_FROM` (ej. `noreply@lepretcapital.com`)

- Backoffice
  - `BACKOFFICE_ALLOWED_EMAILS` (coma separada)
  - `BACKOFFICE_NOTIFICATIONS` (coma separada)

- PandaDoc
  - `PANDADOC_API_KEY`
  - `PANDADOC_BASE_URL` = `https://api.pandadoc.com`
  - `PANDADOC_TEMPLATE_CONTRATO_MARCO` = `<UUID_PLANTILLA>`
  - `PANDADOC_SIGN_ROLE` = `Firmante` (o el nombre exacto de tu plantilla)
  - `PANDADOC_WEBHOOK_SECRET` = `<cadena_larga>`
  - `PANDADOC_SEND` = `false` (recomendado)
  - `PANDADOC_ALLOW_FORCE_SIGN` = `false`
  - `PANDADOC_APP_URL` = `https://app.pandadoc.com/a/#/documents/` (opcional)

- App
  - `NEXT_PUBLIC_BASE_URL` = (vacío; usamos rutas relativas)

Sugerencia: replica estos valores también en “Preview” si deseas probar con ramas. PandaDoc normalmente apunta al dominio de producción, por lo que los webhooks de Preview no se recibirán.

## 5) Webhook – Validación
- La app valida la firma en headers `x-pandadoc-signature` o en el query param `signature`.
- Soporta eventos: `document.completed`, `recipient_completed` o tag `document.completed`.
- Si ves 401 en ngrok/Vercel:
  - Asegura que el Secret en PandaDoc sea **exactamente** el mismo que `PANDADOC_WEBHOOK_SECRET` y que no tenga espacios.

## 6) Post‑Deploy – Pruebas rápidas
1. Login y /hq (correo en `BACKOFFICE_ALLOWED_EMAILS`).
2. Crea una org CLIENT en `/select-org` y entra al portal `/c/<orgId>/requests`.
3. Crea solicitud → Genera oferta → Acepta.
4. “Preparar contrato”:
   - Si el doc queda en borrador: “Abrir en PandaDoc” y pulsa **Enviar** desde PandaDoc.
   - “Copiar enlace de firma” cuando el doc esté Enviado.
5. Firma y verifica:
   - `/api/webhooks/pandadoc` debe recibir el evento (200).
   - `funding_requests` pasa a `signed` y se guarda PDF en `contracts/<companyId>/<documentId>.pdf`.
6. “Marcar desembolso” (staff) para pasar a `funded` y notificar al cliente.

## 7) Staging (opcional)
- Crea un proyecto Supabase “staging” y repite el paso 1 con otra base de datos.
- Configura un subdominio (ej. `staging.lepretcapital.com`) en Vercel.
- Usa otra URL de webhook en PandaDoc para staging (y otro Secret) si deseas pruebas separadas.

## 8) Solución de problemas
- PandaDoc 403 `/send`: la cuenta restringe envíos por API a destinatarios externos. Usa “Abrir en PandaDoc” para enviarlo manualmente.
- PandaDoc 400 `session`: “Cannot create session for document.draft” → primero “Enviar” el documento en PandaDoc, luego generar enlace.
- Webhook 401 `invalid_signature`: Secret distinto o faltante; PandaDoc puede enviar firma en query `signature`.
- Correos de Resend no llegan: verifica que el dominio esté **Verified** y revisa spam/cuarentena. `EMAIL_FROM` debe ser del dominio verificado.
- Backoffice 401 en `/hq`: revisa `BACKOFFICE_ALLOWED_EMAILS` y reinicia para recargar env.

---

## 9) Apéndice – Variables de Entorno (ejemplo prod)
```
# Supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Resend
RESEND_API_KEY=...
EMAIL_FROM=noreply@lepretcapital.com

# Backoffice
BACKOFFICE_ALLOWED_EMAILS=cjvives@prosanvi.com,ediazgranados@lepretcapital.com
BACKOFFICE_NOTIFICATIONS=cjvives@prosanvi.com,ediazgranados@lepretcapital.com

# PandaDoc
PANDADOC_API_KEY=...
PANDADOC_BASE_URL=https://api.pandadoc.com
PANDADOC_TEMPLATE_CONTRATO_MARCO=YFJp93pEXnrZu5PuwVgSi4
PANDADOC_SIGN_ROLE=Firmante
PANDADOC_WEBHOOK_SECRET=... # el mismo en PandaDoc Webhooks
PANDADOC_SEND=false
PANDADOC_ALLOW_FORCE_SIGN=false
PANDADOC_APP_URL=https://app.pandadoc.com/a/#/documents/

# App
NEXT_PUBLIC_BASE_URL=
```

Con esto, el proyecto queda listo para desplegar en Vercel sin bloqueos. Si quieres, puedo automatizar un “staging” en Vercel con variables separadas y preparar un breve runbook de rollback.

