export default function CostosPage() {
  return (
    <div className="py-20 sm:py-24">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-colette text-3xl font-bold tracking-tight text-lp-primary-1 sm:text-4xl text-center">
          Transparencia de Costos
        </h1>
        <div className="mt-10 text-lg leading-8 text-lp-sec-3 space-y-6">
          <p>
            En LePrêt Capital, creemos en la transparencia total. Nuestros costos son claros y sin letra pequeña, para que siempre sepas exactamente cuánto pagarás.
          </p>
          <h2 className="font-colette text-2xl font-bold text-lp-primary-1 mt-8">
            Estructura de Costos
          </h2>
          <p>
            Nuestra tarifa se calcula como un porcentaje sobre el valor nominal de la factura, y varía en función del plazo de vencimiento de la factura y el perfil de riesgo del pagador.
          </p>
          <p>
            Por ejemplo, para una factura de $10.000.000 con vencimiento a 30 días, la tasa podría ser del 1.5%. Esto significa que recibirías $9.850.000. Para una factura a 90 días, la tasa podría ser del 3.5%, recibiendo $9.650.000.
          </p>
          <p className="italic">
            (Nota: Estos son ejemplos didácticos. Las tasas reales se te informarán claramente en tu propuesta de preaprobación.)
          </p>
          <h2 className="font-colette text-2xl font-bold text-lp-primary-1 mt-8">
            Sin Costos Ocultos
          </h2>
          <p>
            No hay cargos por estudio de crédito, comisiones por desembolso, ni penalidades por prepago. Solo pagas por el servicio de anticipo de tu factura.
          </p>
          {/* TODO: Add interactive pricing explainer if time permits */}
        </div>
      </div>
    </div>
  );
}
