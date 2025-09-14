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
- `GET/POST /api/c/:orgId/requests` — lista/crea solicitudes (mock).
- `GET /api/c/:orgId/me` — devuelve sesión/membresía de ejemplo.

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
