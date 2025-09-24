# LePrêt Capital - Sitio Web

Este repositorio contiene el código fuente del sitio web productivo para LePrêt Capital, una fintech de factoring electrónico B2B en Colombia.

## Objetivo del Sitio

El objetivo principal del sitio es captar y convertir PYMES B2B interesadas en anticipar facturas electrónicas (DIAN/RADIAN), destacando la rapidez, simpleza, transparencia y la preaprobación online. Además, busca construir confianza a través de sellos, aliados y testimonios, y educar al público mediante una sección de preguntas frecuentes. Está diseñado para escalar a futuras soluciones como confirming y supply chain finance.

## Stack Tecnológico

*   **Framework:** Next.js 14 (App Router)
*   **Lenguaje:** TypeScript
*   **Estilos:** Tailwind CSS
*   **Componentes UI:** shadcn/ui (basado en Radix)
*   **Validación de Formularios:** Zod + React Hook Form
*   **Base de Datos:** Supabase (PostgreSQL)
*   **Emails:** Resend (integración preparada, requiere configuración)
*   **Despliegue:** Vercel

## Características Principales (MVP)

*   **Página de Inicio (`/`):
    *   Sección Hero con CTA principal ("Generar oferta") y secundario ("Hablar con un asesor").
    *   Sección "Cómo funciona" (3 pasos).
    *   Sección "Beneficios" (bullets claros).
    *   Sección "Cifras/Confianza" (métricas placeholder).
    *   Sección "Aliados/Certificaciones" (placeholders).
    *   Sección "Testimonios" (carrusel).
    *   Sección "Preguntas Frecuentes" (FAQ).
*   **Preaprobación (`/preaprobacion`):
    *   Formulario de preaprobación con validación en tiempo real.
    *   Endpoint API (`/api/preaprobacion`) para procesar la solicitud, calcular cupo estimado y persistir en DB.
    *   Feedback inmediato al usuario con cupo estimado y próximos pasos.
*   **Páginas de Contenido:
    *   Factoring Electrónico (`/soluciones/factoring-electronico`)
    *   Costos (`/costos`)
    *   Quiénes Somos (`/empresa`)
    *   Contacto (`/contacto`) con formulario funcional y endpoint API (`/api/contact`).
    *   Páginas Legales (`/legal/privacidad`, `/legal/terminos`).
*   **Placeholders:
    *   Confirming (`/soluciones/confirming`)
    *   Dashboard de Usuario (`/app`)
*   **Theming:** Paleta de colores y tipografías (Colette, Kollektif) de marca configuradas vía Tailwind CSS y `next/font/local`.
*   **SEO:** `robots.txt` y `sitemap.xml` configurados.

## Cómo Correr el Proyecto Localmente

1.  **Clonar el Repositorio:**
    ```bash
    git clone [URL_DEL_REPOSITORIO]
    cd LePret/lepret
    ```
2.  **Instalar Dependencias:**
    ```bash
    npm install
    ```
3.  **Configurar Variables de Entorno:**
    Crea un archivo `.env` en la raíz del directorio `lepret` con las siguientes variables:
    ```
    SUPABASE_URL="https://TU_PROYECTO.supabase.co"
    SUPABASE_SERVICE_ROLE_KEY="TU_SERVICE_ROLE_KEY"
    NEXT_PUBLIC_SUPABASE_URL="https://TU_PROYECTO.supabase.co"
    NEXT_PUBLIC_SUPABASE_ANON_KEY="TU_ANON_KEY"
    RESEND_API_KEY="re_YOUR_RESEND_API_KEY"
    ```
    *   `SUPABASE_URL`: URL de tu proyecto Supabase.
    *   `SUPABASE_SERVICE_ROLE_KEY`: Clave de servicio de Supabase para operaciones del lado del servidor.
    *   `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto expuesta al cliente (debe coincidir con `SUPABASE_URL`).
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Clave pública (`anon`) usada por el cliente para establecer sesiones temporales.
    *   `RESEND_API_KEY`: Clave API de Resend para el envío de correos. (Opcional para el funcionamiento básico, pero necesaria para notificaciones).

4.  **Ejecutar el Servidor de Desarrollo:**
    ```bash
    npm run dev
    ```
    El sitio estará disponible en `http://localhost:3000`.

## Cómo Desplegar en Vercel

Este proyecto está optimizado para despliegue en Vercel.

1.  **Conectar Repositorio:** Conecta tu repositorio de GitHub/GitLab/Bitbucket a Vercel.
2.  **Configurar Variables de Entorno:** En la configuración del proyecto en Vercel, añade las mismas variables de entorno (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`) que usaste localmente.
3.  **Despliegue Automático:** Cada push a la rama principal (o a una PR, si configuras los preview deploys) activará un nuevo despliegue.

## Supabase como Base de Datos

Supabase se utiliza como capa de persistencia del proyecto y reemplaza el uso de Prisma. Todas las operaciones contra PostgreSQL se realizan mediante el SDK `@supabase/supabase-js`, por lo que no es necesario configurar ni generar clientes de Prisma.

### Variables de entorno

Asegúrate de definir en tu archivo `.env` las variables:

```
SUPABASE_URL="https://TU_PROYECTO.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="TU_SERVICE_ROLE_KEY"
NEXT_PUBLIC_SUPABASE_URL="https://TU_PROYECTO.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="TU_ANON_KEY"
```

Las variables sin el prefijo `NEXT_PUBLIC_` se utilizan del lado del servidor, mientras que las públicas permiten que el cliente establezca sesiones válidas para operaciones como el restablecimiento de contraseñas.

### Aplicar el esquema inicial

1. Ingresa al panel de Supabase y abre el SQL Editor, o utiliza la CLI de Supabase.
2. Ejecuta el contenido del archivo `docs/supabase-schema.sql` para crear las tablas requeridas.

Con esto, la base de datos quedará lista para su uso en el proyecto.

## Cómo Cambiar Reglas del "Cupo Estimado"

La lógica para calcular el `cupoEstimado` se encuentra en el archivo `src/app/api/preaprobacion/route.ts`, dentro de la función `calculateCupo`. Puedes modificar esta función para ajustar las reglas de negocio según sea necesario.

## Estructura de Directorios Clave

*   `src/app`: Rutas de Next.js (páginas y API routes).
*   `src/components`: Componentes reutilizables.
    *   `src/components/ui`: Componentes de shadcn/ui.
    *   `src/components/forms`: Formularios específicos.
    *   `src/components/landing`: Componentes de la página de inicio.
*   `src/lib`: Utilidades y lógica de negocio.
    *   `src/lib/validators`: Esquemas de validación Zod.
*   `public`: Archivos estáticos (imágenes, fuentes, `robots.txt`, `sitemap.xml`).

---

**Nota:** Este proyecto es un MVP funcional. Las integraciones reales con DIAN/RADIAN y otros sistemas (ERP/Facturadores) están diseñadas a nivel de interfaz (`lib/integrations/`) pero no están conectadas. El sitio está listo para producción y fácil de evolucionar.