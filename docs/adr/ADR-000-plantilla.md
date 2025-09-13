---
id: ADR-000
titulo: "<Título de la decisión>"
estado: "Propuesta" # Propuesta | Aceptada | Rechazada | Obsoleta | Sustituida
fecha: "<AAAA-MM-DD>"
decisores: "<Nombres/Roles>"
consultados: "<Stakeholders>"
relaciones: {
  sustituyeA: "",
  sustituidaPor: ""
}
---

# ADR-000: Autenticación con next-auth + Supabase

## Contexto

El portal de usuarios de LePrêt requiere autenticación segura, flexible y escalable. Debemos permitir que un usuario pueda pertenecer a varias organizaciones (multi-org) y manejar roles (RBAC) con control granular. Restricciones:

* **Técnicas:** El stack actual está en Next.js 14 + Supabase (sin Prisma).
* **Negocio:** Cumplir con KYC y auditoría.
* **Compliance:** GDPR/LOPD, seguridad en acceso.
* **Objetivos:** Implementar login seguro con MFA opcional, multi-org y escalable en Supabase.

## Decisión

Usaremos **next-auth** con sesiones server-side y Supabase como store de usuarios y memberships.

* **Métodos:** Credentials (email/password) y Magic Link.
* **Opcionales:** OAuth (Google/Microsoft) en fases posteriores.
* **MFA:** activable vía TOTP (2FA\_enabled en tabla users).
* **Scopes:** verificados por middleware en server actions.

## Alternativas consideradas

* **Supabase Auth nativo:** integración directa, pero menos flexible para multi-org y roles complejos.
* **Auth0:** robusto pero coste elevado y vendor lock-in.
* **Next-auth + Supabase:** equilibrio entre control, flexibilidad y coste (elección final).

## Consecuencias

* **Positivas:**

  * Control completo en BD (Supabase).
  * Integración directa con roles y RLS.
  * Compatibilidad futura con OAuth.
* **Negativas:**

  * Necesidad de configurar manualmente flows multi-org.
  * Mayor complejidad que Supabase Auth.
* **Impacto:** Seguridad reforzada, ligera curva de aprendizaje para devs.

## Plan de implementación

1. Configurar next-auth en `/api/auth/*`.
2. Guardar usuarios en tabla `users` de Supabase.
3. Middleware: validar session y orgId en ruta.
4. Añadir MFA opcional vía TOTP.
5. QA: pruebas e2e con múltiples orgs.
6. Feature flag para habilitar MFA progresivamente.

## Métricas de éxito

* <1% intentos de login fallidos por error técnico.
* > 95% cobertura tests de auth.
* MFA habilitado por al menos 20% de usuarios en 6 meses.

## Riesgos y mitigaciones

* **Riesgo:** Sesiones hijack. → **Mitigación:** Cookies httpOnly, rotation tokens.
* **Riesgo:** RLS mal configurado. → **Mitigación:** pruebas automáticas de acceso.
* **Riesgo:** Baja adopción MFA. → **Mitigación:** campañas de concientización + incentivos.

## Referencias

* [next-auth docs](https://next-auth.js.org/)
* [Supabase RLS docs](https://supabase.com/docs/guides/auth/row-level-security)
* ADR en `docs/adr/ADR-000-auth.md`
