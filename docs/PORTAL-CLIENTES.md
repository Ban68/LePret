Portal de Clientes — Fase 1 (Skeleton)
=====================================

Rutas Base
----------
- `/c/:orgId` — Resumen
- `/c/:orgId/invoices` — Facturas (placeholder)
- `/c/:orgId/requests` — Solicitudes (placeholder)
- `/c/:orgId/settings` — Ajustes (placeholder)

Middleware
----------
- `middleware.ts` — Placeholder que prepara `auth()` y matchea `"/c/:path*"`. Actualmente no bloquea acceso; descomentar redirect para exigir login.

Autenticación (Supabase Auth — nativo)
-------------------------------------
- Cliente: `src/lib/supabase-browser.ts`.
- Servidor: `src/lib/supabase-server.ts` y `middleware.ts` con `createMiddlewareClient`.
- Páginas: `/login` y `/register` (email+password y Magic Link).

APIs Placeholder
----------------
- `GET/POST /api/c/:orgId/invoices` — lista/crea facturas (mock).
- `POST /api/c/:orgId/invoices/extract` — extrae monto, fechas y pagador desde un PDF (máx. 10 MB, `multipart/form-data`). La respuesta entrega `amount`, `issue_date`, `due_date`, `payer_name` y `payer_tax_id` normalizados para precargar el formulario de factura.
- `GET/POST /api/c/:orgId/requests` — lista/crea solicitudes (mock).
- `GET /api/c/:orgId/me` — devuelve sesión/membresía de ejemplo.

Autocompletado desde PDF
------------------------
- El flujo de carga de facturas consume `POST /api/c/:orgId/invoices/extract` para leer PDFs y proponer los campos principales.
- Pasos sugeridos para el cliente:
  1. Subir el PDF de la factura (formato vectorial o texto embebido; imágenes puras sin OCR no se procesan).
  2. Revisar los campos precargados en la UI (monto, fechas, pagador y NIT) y ajustar cualquier dato inconsistente.
  3. Confirmar y guardar la factura si los valores son correctos.
- Limitaciones conocidas:
  - Solo se soportan archivos `.pdf` hasta 10 MB. Otros formatos deben convertirse antes de la carga.
  - El parser depende de texto legible; documentos escaneados sin OCR o con layouts inusuales pueden devolver campos `null`.
  - Siempre se requiere validación humana antes de aprobar la operación.

Supabase (Esquema mínimo con RLS)
---------------------------------
- Archivos: `docs/supabase-schema.sql` (añadidas `profiles`, `companies`, `memberships`, `invoices`, `funding_requests` + políticas básicas por membresía/autor).

- Servidor: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (opcional).
- Cliente: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Ejemplo: ver `.env.example`.

Notas
-----
- Navbar incluye un enlace de acceso rápido al portal (`/c/demo`). Reemplazar `demo` por el `orgId` real al integrar.
- Próximos pasos: poblar `profiles/companies/memberships`, reforzar middleware con verificación de membership, y conectar APIs con Supabase (RLS activo).

Firma Electrónica
-----------------
- Proveedor: PandaDoc. Placeholder en `src/lib/integrations/pandadoc.ts`.
- Variables: `PANDADOC_API_KEY`, `PANDADOC_BASE_URL`.
