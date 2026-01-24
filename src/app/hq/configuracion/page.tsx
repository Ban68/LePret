import { SettingsForm } from "../ui/SettingsForm";

export const metadata = {
  title: "Configuración | Headquarters",
};

export default function HqConfigPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-lp-primary-1">Parámetros del programa</h2>
        <p className="text-sm text-lp-sec-3">
          Ajusta tasas, límites y plazos utilizados para originaciones y aprobación automática.
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}
