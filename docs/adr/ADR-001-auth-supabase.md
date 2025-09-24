---
id: ADR-001
titulo: "Autenticación con Supabase Auth (sin NextAuth)"
estado: "Aceptada"
fecha: "2025-09-13"
decisores: "Equipo Dev / Producto"
consultados: "Operaciones / Seguridad"
relaciones: {
  sustituyeA: "",
  sustituidaPor: ""
}
---

# ADR-001: Autenticación con Supabase Auth (sin NextAuth)

## Contexto

El portal requiere autenticación segura, soporte multi‑organización y control de acceso mediante RLS en Postgres. El repositorio ya usa `@supabase/auth-helpers-nextjs` (middleware, server y client helpers) y las políticas de la base de datos dependen de `auth.uid()` de Supabase.

## Decisión

Adoptamos **Supabase Auth** como proveedor de identidad y sesión, integrándolo con Next.js mediante `@supabase/auth-helpers-nextjs`. No se usará NextAuth por ahora.

## Razones

- **Compatibilidad directa con RLS**: `auth.uid()` funciona de forma nativa con los JWT de Supabase.
- **Simplicidad**: menos componentes y sin necesidad de puentes para emitir JWT de Supabase desde NextAuth.
- **Consistencia**: el código existente (middleware y rutas) ya está basado en Supabase Auth Helpers.

## Alternativas consideradas

- NextAuth (Auth.js): potencia y múltiples proveedores OAuth, pero requeriría puentear sesiones a Supabase para RLS o degradar a service role.
- Auth0/Cognito: mayor complejidad y coste, sin beneficio claro frente a Supabase en este caso.

## Consecuencias

- Positivas: menor complejidad operativa, RLS usable end‑to‑end, menos superficie de errores.
- Negativas: si en el futuro se requiere un ecosistema OAuth muy amplio, habrá que configurar proveedores en Supabase o reevaluar NextAuth.

## Implementación

1. Mantener helpers: `createMiddlewareClient`, `createRouteHandlerClient`, `createServerComponentClient`.
2. Centralizar acceso en `src/auth.ts` con `auth()`, `requireAuth()`, `getUserId()`, `isStaff()`.
3. Middleware: validar sesión, recordar `last_org`, y forzar membresía o bypass por `profiles.is_staff`.
4. Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Métricas de éxito

- Rutas protegidas respetan RLS sin uso de service role en cliente.
- 0 errores de compilación por imports de auth.
- Flujos básicos de login/logout y acceso a `/c/:orgId` funcionando.

## Referencias

- Supabase Auth Helpers for Next.js: https://supabase.com/docs/guides/auth/server-side/nextjs
- RLS en Postgres/Supabase: https://supabase.com/docs/guides/auth/row-level-security

