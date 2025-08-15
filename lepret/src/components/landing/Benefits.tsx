const benefits = [
  {
    name: 'Preaprobación Online',
    description: 'Obtén una oferta preliminar en minutos, sin papeleo y 100% en línea.',
    icon: '✔️',
  },
  {
    name: 'Fondos en 24-48h',
    description: 'Accede a tu liquidez rápidamente una vez verificada la operación.',
    icon: '✔️',
  },
  {
    name: 'Integrado a la DIAN',
    description: 'Conectamos directamente con RADIAN para un proceso ágil y seguro.',
    icon: '✔️',
  },
  {
    name: 'No Afecta tu Crédito',
    description: 'El factoring es una venta de activo, no una deuda. No consume tus cupos de crédito.',
    icon: '✔️',
  },
  {
    name: 'Transparencia Total',
    description: 'Conoce todos los costos desde el inicio. Sin letra pequeña ni sorpresas.',
    icon: '✔️',
  },
  {
    name: 'Soporte Humano',
    description: 'Nuestro equipo de expertos está disponible para ayudarte cuando lo necesites.',
    icon: '✔️',
  },
];

export function Benefits() {
  return (
    <section className="py-20 sm:py-32 bg-lp-sec-4">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-colette text-3xl font-bold tracking-tight text-lp-primary-1 sm:text-4xl">
            Beneficios de trabajar con LePrêt
          </h2>
          <p className="mt-4 text-lg leading-8 text-lp-sec-3">
            Diseñado para la agilidad y crecimiento de tu PYME.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <div key={benefit.name} className="flex items-start space-x-4">
              <div>
                <span className="text-2xl">{benefit.icon}</span>
              </div>
              <div>
                <h3 className="font-colette text-xl font-semibold text-lp-primary-1">{benefit.name}</h3>
                <p className="mt-1 text-base text-lp-sec-3">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
