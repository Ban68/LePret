import { Suspense } from "react";

import { InvestorSettingsClient } from "./ui/InvestorSettingsClient";

export default function InvestorSettingsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-lp-primary-1">Configuración del inversor</h2>
        <p className="text-sm text-lp-sec-3">
          Administra la cuenta bancaria de desembolsos, tus preferencias de notificación y los usuarios autorizados a operar en
          esta organización.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="rounded-lg border border-dashed border-lp-gray-200 p-6 text-sm text-lp-sec-3">
            Cargando configuración…
          </div>
        }
      >
        <InvestorSettingsClient />
      </Suspense>
    </div>
  );
}
