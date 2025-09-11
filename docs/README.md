# Documentación del Proyecto

Bienvenido al directorio `docs/`. Aquí centralizamos el conocimiento del proyecto: planes, decisiones, procesos y referencias.

## Índice
- Plan de Desarrollo: [docs/PLAN_DE_DESARROLLO.md](./PLAN_DE_DESARROLLO.md)
- Decisiones de Arquitectura (ADR): carpeta [docs/adr/](./adr/)
- Lectura (textos explicativos): carpeta [docs/lectura/](./lectura/)
  - Descripción de la App: [docs/lectura/DESCRIPCION_DE_LA_APP.md](./lectura/DESCRIPCION_DE_LA_APP.md)
- Portal de Clientes: [docs/PORTAL-CLIENTES.md](./PORTAL-CLIENTES.md)
- Esquema Supabase (SQL): [docs/supabase-schema.sql](./supabase-schema.sql)

## ADRs (Architecture Decision Records)
Las ADR documentan decisiones significativas de diseño/arquitectura junto con su contexto y consecuencias. Úsalas para decisiones con impacto técnico o de producto sostenido en el tiempo.

### Cómo crear una nueva ADR
1) Copia la plantilla: `docs/adr/ADR-000-plantilla.md`
2) Nómbrala `ADR-XYZ-titulo-kebab-case.md` (por ejemplo, `ADR-001-autenticacion-oidc.md`)
3) Actualiza `id`, `título`, `estado` y el contenido.
4) Cambia el `estado` a `Aceptada` al aprobarse; usa `Rechazada`, `Obsoleta` o `Sustituida` según corresponda.

### Estados recomendados
- Propuesta: en discusión.
- Aceptada: aprobada y en curso/implantada.
- Rechazada: no se adoptará.
- Obsoleta: ya no aplica, pero conserva contexto histórico.
- Sustituida: reemplazada por otra ADR (enlaza la nueva).

### Buenas prácticas
- Enfoca cada ADR en una sola decisión.
- Describe opciones consideradas y por qué se descartaron.
- Explica consecuencias (positivas y negativas) y riesgos.
- Enlaza PRs, issues, diagramas y métricas relevantes.

---

## Cómo editar estos documentos
- Abre el archivo en esta carpeta, escribe en español claro y guarda.
- Prioriza Markdown (`.md`); también puedes subir `.txt` si prefieres.
- Para crear uno nuevo, copia una plantilla o crea un archivo `.md` vacío.
- No te preocupes por el formato perfecto: títulos y listas son suficientes.
- Una vez guardado en `docs/`, yo podré leerlo y usarlo como referencia.

## Sugerencias de organización adicional
- `docs/adr/` para decisiones.
- `docs/api/` para especificaciones de API.
- `docs/design/` para diagramas y propuestas técnicas.
- `docs/runbooks/` para procedimientos operativos.
