Fase 2 — Portal de Usuarios LePrêt (Clientes →
 Inversionistas → Accionistas/Empleados)
 Stack base actualizado (según repo): Next.js 14 (App Router) + TypeScript + Tailwind +
 shadcn/ui + Zod + React Hook Form + @supabase/supabase-js (PostgreSQL con RLS); 
Resend para emails. next-auth (Credentials + Magic Link/OAuth opcional) a incorporar
 en Fase 2. React Query/Zustand opcionales para estado cliente (no imprescindibles
 ahora). Sin Prisma (no se usa en el repo). Colas: Inngest o BullMQ (posterior). Storage:
 Supabase Storage. E‑firma: DocuSign/Zoho Sign (conector abstraído).
 0.5) Estado actual del repositorio (confirmado)
 • 
• 
• 
• 
Front marketing en producción (Next 14) con secciones públicas (home, costos, soluciones,
 empresa, contacto, legal).
 APIs existentes: 
/api/preaprobacion (calcula 
cupoEstimado y persiste en 
preapprovals ) y 
/api/contact (persiste en 
capturan UTM, IP y UA.
 contacts ). Ambas insertan en Supabase y
 Formulario de Preaprobación funcional (
 PreApprovalForm ) enlazado a la ruta 
preaprobacion .
 Base técnica vigente: 
/
 @supabase/supabase-js (sin Prisma), validación UI con Zod/RHF,
 Resend listo.
 • 
Aún no hay autenticación, RBAC ni portal 
/c/:orgId .
 0) Principios y objetivos
 • 
• 
• 
• 
Seguridad y cumplimiento: RBAC (control de acceso por roles), auditoría completa, cifrado en
 reposo y tránsito, revalidación con MFA opcional.
 Multi‑org: un usuario puede pertenecer a varias organizaciones (empresa cliente, vehículo de
 inversión, holding).
 Trazabilidad: toda operación (factoring) tiene estados, tiempos, documentos y responsables.
 MVP incremental: publicar rápido el Portal Clientes con el flujo “subir facturas → oferta →
 aceptación → firma → desembolso → seguimiento”.
 1) Tipos de usuario y capacidades
 1.1 Clientes (Empresas cedentes)
 MVP: - Registro/autenticación y alta de empresa (KYC básico). - Perfil de empresa (razón social, NIT/
 SIREN, actividad, representante legal, cuenta bancaria). - Crear solicitud de factoring: subir facturas
 (PDF/imagen), datos del deudor, fechas, monto, adjuntos (orden de compra, guía, acta). - OCR +
 extracción (opcional MVP1; sino captura manual), validación y preview. - Enrutamiento a análisis:
 check preliminar (límites, listas restrictivas, deudor permitido), luego estado “En análisis”. - Oferta:
 mostrar condiciones (tasa, aforo, comisiones, fecha desembolso estimada), botón “Aceptar oferta”. 
1
E‑firma de contrato y cesión. - Seguimiento: tablero por operación (línea de tiempo, documentos,
 mensajes), estado de cobranza y pagos. - Notificaciones: email + in‑app.
 Posterior: - Catálogo de deudores frecuentes, plantillas, carga masiva (CSV), API webhook para ERPs.
 1.2 Inversionistas (personas/empresas que prestan a LePrêt)
 • 
• 
Tablero: capital invertido, rendimiento YTD/TWR, posiciones vigentes, flujos, calendario de
 vencimientos, estado de pagos.
 Documentos (contratos, extractos), suscripciones/retiros, perfil fiscal.
 1.3 Accionistas y Empleados LePrêt
 • 
• 
KPIs: originación, cartera, rotación, mora, recuperaciones, unit economics, liquidez.
 Vistas por cohorte, deudor, sector, analista. Exportables.
 2) Roles y permisos (RBAC granular)
 • 
• 
• 
• 
• 
• 
• 
• 
OWNER_ORG (dueño de org cliente) — Administra miembros, firma.
 ADMIN_ORG (admin cliente) — Crea operaciones, gestiona deudores, ve estados.
 OPERATOR_ORG (operativo cliente) — Carga y edita solicitudes antes de enviar.
 VIEWER_ORG (consulta cliente) — Solo lectura.
 INVESTOR — Acceso a dashboard inversión propio.
 STAFF_ANALYST — Revisión, oferta, gestión documentos.
 STAFF_COLLECTIONS — Cobranza y pagos.
 STAFF_ADMIN — Parámetros, tarifas, catálogos.
 Regla: permisos se asignan por Membership (usuario↔org↔role). Scopes por recurso (operation:read,
 offer:create, contract:sign, files:upload, etc.).
 3) Modelo de datos (Supabase — esquema base, sin Prisma)
 3.1 Núcleo identidad
 • 
• 
• 
User: id, email, nombre, phone, 2FA_enabled, terms_version.
 Org: id, tipo (CLIENT|INVESTOR|HOLDING), nombre, tax_id, país, estado_kYC, bank_account_id.
 Membership: id, user_id, org_id, role, status.
 3.2 Factoring
 • 
• 
• 
• 
• 
• 
Debtor: id, org_id (del cliente), nombre, tax_id, sector, límite_crediticio, rating.
 Operation: id, org_id (cliente), status (DRAFT|SUBMITTED|UNDER_REVIEW|OFFERED|
 ACCEPTED|SIGNED|FUNDED|SETTLED|REJECTED|CANCELLED), monto_solicitado, moneda,
 created_by, timestamps.
 Invoice: id, operation_id, debtor_id, número, fecha_emisión, fecha_vencimiento, monto_bruto,
 impuestos, neto, archivo_id, estado_validación.
 Offer: id, operation_id, tasa_anualizada, aforo, comisiones, fecha_validez, condiciones_json.
 Contract: id, operation_id, provider (DOCUSIGN|ZOHO), envelope_id, status, url_firma.
 Disbursement: id, operation_id, fecha, monto, bank_account_id, status.
 2
• 
• 
• 
• 
Collection: id, operation_id, fecha_pago, monto, status, reference.
 File: id, bucket, path, tipo (INVOICE|PO|CONTRACT|OTHER), checksum, uploader_id.
 Note: id, operation_id, author_id, body, visibility.
 AuditLog: id, actor_id, org_id, recurso, acción, diff_json, ip, user_agent, ts.
 3.3 Inversión (fase 2b)
 • 
• 
• 
• 
• 
InvestorProfile: org_id, tipo (PERSONA|EMPRESA), KYC, perfil_riesgo.
 Fund / Vehicle (si aplica): id, nombre, política.
 Position: investor_org_id, vehicle_id, principal, aportes, retiros.
 Distribution: id, position_id, fecha, monto, concepto.
 ValuationNav: vehicle_id, fecha, nav.
 3.4 Parámetros (Backoffice)
 • 
• 
RateTable: id, segmento, tasa_base, spread, min/max.
 DebtorLimit: debtor_id, límite, vigente_desde/hasta.
 4) Flujo funcional — Portal Clientes (MVP detallado)
 1) Onboarding - Crear cuenta → verificar email → crear/seleccionar Org CLIENT → completar KYC
 básico (datos empresa + representante + cuenta bancaria + documentos soporte). 2) Nueva Solicitud 
Formulario: deudor (seleccionar/crear), condiciones factura(s), subida de archivos. - Validaciones:
 campos mínimos, duplicados por número de factura, fechas coherentes. - Guardar DRAFT o ENVIAR →
 cambia a SUBMITTED. 3) Análisis (Staff) - Checklists (listas restrictivas, límites de deudor,
 documentación). - Si pasa: UNDER_REVIEW → OFFERED con Offer generada. 4) Oferta (Cliente) - Vista
 con tasa/aforo/comisiones, cálculo estimado de neto a recibir, cronograma estimado. - Botón Aceptar
 → ACCEPTED. 5) Firma - Generar Contract y lanzar envelope en proveedor elegido; redirigir a URL de
 f
 irma. - Al firmar: SIGNED. 6) Desembolso - Registrar Disbursement (manual MVP), adjuntar
 comprobante. - Estado → FUNDED. 7) Cobranza y cierre - Registrar pagos (Collection), conciliar vs.
 calendario; si cubre saldo, SETTLED. 8) Mensajería/Notas - Hilo por operación (cliente↔analista) +
 timeline. 9) Notificaciones - Email + in‑app por hitos: oferta disponible, firma pendiente, fondos
 enviados, pago recibido.
 5) Arquitectura de frontend (Next.js App Router)
 /app
  /(public)
    /login, /register, /reset-password
  /(app)
    /select-org
    /c/:orgId (cliente)
      /dashboard
      /operations
        /new
        /[operationId]
          /overview
          /invoices
 3
          /offer
          /contract
          /disbursement
      /debtors
      /documents
      /settings (miembros, perfiles, cuentas bancarias)
    /i/:orgId (inversionista)  [fase 2b]
      /dashboard, /positions, /flows, /documents
    /hq (staff/accionistas)    [fase 2c]
      /kpis, /originations, /collections, /risk, /settings
 Componentes clave: Wizard de solicitud, Uploader con validaciones, DataGrids, Cards KPI, Timeline,
 Modal de e‑firma, Notificador, RoleGuard, Breadcrumbs, EmptyStates, ErrorBoundaries.
 6) API (Next.js /api + server actions) — Esqueleto
 • 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
Auth: 
/api/auth/* (next-auth)
 Org/Members: 
GET/POST /api/orgs , 
GET/POST /api/orgs/:id/members
 Debtors: 
GET/POST /api/orgs/:id/debtors
 Operations: 
POST /api/orgs/:id/operations (crear); 
PATCH /api/operations/:id (estado)
 Invoices: 
GET /api/operations/:id (ver);
 POST /api/operations/:id/invoices (subir/crear); 
invoices/:id
 Offer: 
DELETE /api/
 POST /api/operations/:id/offer (staff); 
POST /api/offer/:id/accept
 Contract: 
POST /api/operations/:id/contract (generar); 
webhook (callback firma)
 Disbursement: 
POST /api/operations/:id/disburse
 Collections: 
POST /api/operations/:id/collections
 Files: 
POST /api/files/upload (firma con URL pre‑signed)
 Notifications: 
POST /api/notify
 Webhooks: 
POST /api/contract/:id/
 /api/webhooks/sign-provider , 
/api/webhooks/storage , 
accounting .
 /api/webhooks/
 7) Esquema Supabase SQL (fragmentos guía)
 En el repo no se usa Prisma. Definimos el modelo en SQL y aplicamos RLS por 
org_id .-- Núcleo identidad
 create table if not exists orgs (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 tax_id text,
 type text check (type in ('CLIENT','INVESTOR','HOLDING')) default 'CLIENT',
 created_at timestamptz default now()
 );
 4
create table if not exists users (
 id uuid primary key,
 email text unique not null,
 name text,
 created_at timestamptz default now()
 );
 create table if not exists memberships (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references users(id) on delete cascade,
 org_id uuid references orgs(id) on delete cascade,
 role text check (role in
 ('OWNER_ORG','ADMIN_ORG','OPERATOR_ORG','VIEWER_ORG')) not null,
 status text check (status in ('ACTIVE','INVITED','DISABLED')) default
 'ACTIVE',
 unique (user_id, org_id)
 );-- Factoring
 create table if not exists debtors (
 id uuid primary key default gen_random_uuid(),
 org_id uuid references orgs(id) on delete cascade,
 name text not null,
 tax_id text,
 sector text,
 limit numeric(18,2),
 created_at timestamptz default now()
 );
 create table if not exists operations (
 id uuid primary key default gen_random_uuid(),
 org_id uuid references orgs(id) on delete cascade,
 status text check (status in (
 'DRAFT','SUBMITTED','UNDER_REVIEW','OFFERED','ACCEPTED','SIGNED','FUNDED','SETTLED','REJECTED'
 )) default 'DRAFT',
 currency text default 'COP',
 requested numeric(18,2),
 created_by uuid references users(id),
 created_at timestamptz default now()
 );
 create table if not exists invoices (
 id uuid primary key default gen_random_uuid(),
 operation_id uuid references operations(id) on delete cascade,
 debtor_id uuid references debtors(id),
 number text,
 issue_date date,
 due_date date,
 gross_amount numeric(18,2),
 tax_amount numeric(18,2),
 5
net_amount numeric(18,2),
 file_path text,
 created_at timestamptz default now()
 );
 create table if not exists offers (
 id uuid primary key default gen_random_uuid(),
 operation_id uuid references operations(id) on delete cascade,
 annual_rate numeric(6,4),
 advance_pct numeric(5,2),
 fees jsonb,
 valid_until timestamptz
 );-- RLS básico (ejemplo lectura)
 alter table orgs enable row level security;
 alter table memberships enable row level security;
 alter table debtors enable row level security;
 alter table operations enable row level security;
 alter table invoices enable row level security;
 alter table offers enable row level security;
 create policy "orgs read" on orgs
 for select using (
 exists (
 select 1 from memberships m where m.org_id = orgs.id and m.user_id =
 auth.uid() and m.status='ACTIVE'
 )
 );
 8) Seguridad, cumplimiento y auditoría
 • 
• 
• 
• 
• 
• 
Autenticación: session cookies httpOnly, rotation tokens; MFA opcional (TOTP).
 Autorización: middleware server‑side: orgId en ruta; verificación de Membership y Role.
 PII/Documentos: Supabase Storage con buckets por orgId, políticas RLS.
 RLS (Row‑Level Security): habilitado en todas las tablas; vistas materializadas para KPIs.
 Logs: AuditLog con diffs; retención 5 años.
 Backups: snapshots diarios + PITR.
 9) Entregables por sprint (prioridad Portal Clientes)
 Sprint 1 (Sem 1): Identidad + Org + RBAC + Wizard base
 • 
• 
• 
• 
Auth + creación/selección de organización (CLIENT).
 Tablero 
/c/:orgId/dashboard vacío con cards de estado.
 Sección Deudores (CRUD básico).
 Wizard Nueva Solicitud (Stepper: datos generales → facturas → revisión → enviar).
 6
• 
• 
• 
Storage y subida de archivos con validaciones.
 RLS en Supabase + pruebas de acceso.
 Criterios de aceptación: usuario cliente crea org, crea solicitud con 1 factura y la envía; staff ve
 el registro.
 Sprint 2 (Sem 2): Análisis + Oferta + Aceptación
 • 
• 
• 
• 
Panel Staff para cambiar estados y generar Offer con cálculo.
 Vista de Oferta para el cliente con simulador de costos.
 Notificaciones por email (resend/SMTP) en hitos.
 CA: cliente acepta oferta y operación pasa a ACCEPTED.
 Sprint 3 (Sem 3): Firma + Desembolso + Seguimiento
 • 
• 
• 
• 
Integración e‑firma (mock en sandbox) + callback webhook → SIGNED.
 Registro de Disbursement manual y transición a FUNDED.
 Timeline y mensajería interna por operación.
 CA: flujo punta a punta desde solicitud hasta funded.
 Sprint 4 (Sem 4): Calidad + Hardening
 • 
• 
Auditoría completa, métricas, pruebas e2e (Playwright), accesibilidad.
 Exportables (PDF/CSV) básicos.
 Hitos de publicación: Publicar Portal Clientes al final del Sprint 3 en entorno productivo
 controlado.
 10) KPIs y telemetría
 • 
• 
• 
• 
• 
Tiempo desde SUBMITTED → OFFERED → SIGNED → FUNDED.
 Tasa de aprobación por deudor/sector.
 Errores de validación por campo.
 NPS/CSAT del proceso (encuesta post‑funding).
 Uptime, TTFB, Core Web Vitals.
 11) Riesgos y mitigaciones
 • 
• 
• 
• 
E‑firma: dependencia de tercero → abstracción por interfaz + fallback manual.
 OCR: baja precisión → empezar manual; entrenar plantillas después.
 RLS mal configurado: pruebas automatizadas de acceso.
 Carga masiva: limitar en MVP; batch con colas.
 12) Roadmap resumido (Fase 2b y 2c)
 Inversionistas (2b) - Importación posiciones históricas, cálculo TWR/IRR, calendario, extractos
 mensuales, solicitudes de aporte/retiro.
 7
Accionistas/Staff (2c) - Módulo KPIs con vistas y filtros; panel riesgo/mora; bitácora de originación;
 parámetros (tarifas, límites).
 