---
title: Descripción de la Aplicación
version: 0.1.0 (borrador)
fecha: "<AAAA-MM-DD>"
autor: "<Responsable/Equipo>"
estado: "En elaboración"
---

Descripción de la App
1. Propósito y Visión

Propósito: La aplicación permite a clientes, inversionistas y accionistas de LePrêt gestionar operaciones de factoring e inversión en un entorno seguro, auditable y transparente. Visión (6–12 meses): Contar con un portal integral que soporte:

Clientes: solicitudes, gestión y seguimiento de operaciones de factoring punta a punta.

Inversionistas: tableros con posiciones, rendimientos, plazos y documentos.

Accionistas/Staff: KPIs de originación, cartera, mora y liquidez, con vistas analíticas.

2. Propuesta de Valor

Para clientes: acceso ágil a liquidez, con seguimiento digitalizado de cada factura.

Para inversionistas: visibilidad clara del rendimiento y seguridad en la gestión de capital.

Para LePrêt: eficiencia operativa, escalabilidad, cumplimiento regulatorio.

Diferenciadores: trazabilidad completa, integración con e-firma (DocuSign/Zoho), RLS (Row-Level Security), enfoque multi-org.

3. Audiencia y Personas

Persona 1 (Cliente – Pyme): quiere liquidez rápida, se frustra con procesos manuales, valora agilidad y claridad de costos.

Persona 2 (Inversionista – Empresa familiar): busca rentabilidad estable y transparente, teme riesgos ocultos, valora reportes claros y acceso a documentos.

4. Casos de Uso Principales

Como cliente, quiero subir facturas para obtener una oferta de factoring y recibir liquidez.

Como inversionista, quiero ver mi capital invertido y flujos futuros para planificar.

Como staff, quiero aprobar, ofrecer y monitorear operaciones para gestionar riesgo. Criterios de aceptación: flujos punta a punta con estados claros (SUBMITTED → FUNDED).

5. Funcionalidades Clave

MVP (Clientes): Registro/KYC, carga de facturas, validación, oferta, e-firma, desembolso, seguimiento.

Posteriores: Carga masiva CSV, catálogo de deudores, webhooks ERP, dashboards inversionistas, panel KPIs.

6. Flujo del Usuario (alto nivel)
flowchart LR
  A[Cliente] --> B[Registro/KYC]
  B --> C[Subir Factura]
  C --> D[Análisis Staff]
  D --> E[Oferta]
  E -->|Acepta| F[Firma Contrato]
  F --> G[Desembolso]
  G --> H[Seguimiento Cobranza]
7. Contenido y Tono

UX/UI: claro, minimalista, con estados de proceso tipo wizard.

Tono: profesional, confiable, sin tecnicismos excesivos.

Idiomas/localización: Español (ES/CO) inicialmente; escalable a FR/EN.

8. Estado Actual
Rama main (producción – lepretcapital.com)

Proyecto en Next.js 14 + Tailwind + shadcn/ui con el front de marketing ya publicado.

Incluye páginas públicas: home, costos, soluciones, empresa, contacto, legal.

API mínima: /api/preaprobacion y /api/contact (persisten en Supabase).

Sin portal de clientes todavía: no hay autenticación, RBAC ni /c/:orgId.

Documentación básica y supabase-schema.sql.

Rama feat-portal-clientes-sprint-1 (fase de desarrollo portal clientes)

Estructura similar al main, pero ya contiene docs específicos del portal:

docs/PLAN_DE_DESARROLLO.md

docs/PORTAL-CLIENTES.md

docs/supabase-schema.sql

docs/lectura/DESCRIPCION_DE_LA_APP.md

Incluye configuraciones iniciales (middleware.ts, components.json, etc.).

Preparada para empezar Sprint 1: identidad, organizaciones, RBAC, wizard base de solicitud y subida de archivos.

Avance enfocado en scaffolding y documentación interna, aún no en features completas del portal.

Riesgos: dependencia de e-firma externa, OCR no prioritario, RLS crítico a validar【24†Fase 2 — Portal De Usuarios Le Prêt.pdf】.

9. Roadmap Breve

Sprint 1: Identidad + Org + RBAC + Wizard base (carga factura).

Sprint 2: Análisis + Oferta + Aceptación.

Sprint 3: Firma + Desembolso + Seguimiento.

Sprint 4: Calidad + Auditoría + Exportables.

10. Glosario

Factoring: Cesión de facturas a cambio de liquidez inmediata.

RLS (Row-Level Security): Restricción a nivel de fila en base de datos.

KYC: Conozca a su cliente (obligación regulatoria).

Org: Organización dentro del sistema (cliente, inversionista o holding).

11. Referencias

Documento de roadmap: Fase 2 — Portal de Usuarios LePrêt【23†Fase 2 — Portal De Usuarios Le Prêt.pdf】

Repositorio actual (Next.js 14, Supabase, shadcn/ui).

Mockups y diagramas (pendientes de adjuntar).

Zips de referencia: LePret-main (producción), LePret-feat-portal-clientes-sprint-1 (desarrollo portal).