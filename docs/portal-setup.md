# Portal de Clientes – Configuración

Esta guía agrega autenticación, operaciones e invoices al proyecto para habilitar el portal de clientes.

## 1) Variables de Entorno

En `.env` agrega las claves públicas para el cliente (o usa las existentes si ya están):

```
NEXT_PUBLIC_SUPABASE_URL="https://TU_PROYECTO.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="TU_ANON_KEY"
SUPABASE_URL="https://TU_PROYECTO.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="TU_SERVICE_ROLE_KEY"
```

Notas:
- El cliente usa `NEXT_PUBLIC_*` o en su defecto `SUPABASE_URL`/`SUPABASE_ANON_KEY`.
- Asegúrate de habilitar Email+Password en Supabase Auth (Authentication → Providers).

## 2) Esquema y RLS

Ejecuta en Supabase SQL Editor, en este orden:

1. `docs/supabase-schema.sql` (si no lo has ejecutado)
2. `docs/supabase-portal.sql` (perfiles, operaciones, invoices, documentos y políticas)

Esto crea:
- `profiles` (vinculado a `auth.users`)
- `operations`, `invoices`, `documents`
- Bucket privado `invoices` y políticas de Storage (ruta `auth.uid()/...`).

## 3) Rutas del Portal

- `/login` y `/register`: autenticación email/password.
- `/app` (dashboard), protegido por guardia de sesión.
- `/app/operaciones`: lista de operaciones del usuario.
- `/app/operaciones/nueva`: formulario para crear operación.
- `/app/operaciones/[id]`: detalle con carga de facturas (Storage + `documents`).

## 4) Flujo de Carga de Facturas

El componente `InvoiceUpload` sube archivos al bucket `invoices` bajo `userId/operationId/archivo.ext` y registra metadatos en `documents`.

## 5) Notas y Próximos Pasos

- Validar que la política de Storage respete el prefijo `auth.uid()/...`.
- Incorporar cálculo de costos y estado en UI una vez definida la lógica.
- Agregar vistas para editar datos de factura y/o integración con RADIAN/ERP.

