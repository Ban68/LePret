export default function SettingsPage({ params }: { params: { orgId: string } }) {
  return (
    <div className="space-y-6">
      <h1 className="font-colette text-2xl font-bold text-lp-primary-1">Ajustes</h1>
      <p className="text-lp-sec-3">Configuración de la organización {params.orgId} (placeholder).</p>
      <div className="rounded-lg border border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">
        Próximamente podrás gestionar miembros, datos de la empresa y preferencias.
      </div>
    </div>
  );
}

