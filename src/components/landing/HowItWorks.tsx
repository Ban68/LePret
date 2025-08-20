import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    name: 'Regístrate y conecta',
    description: 'Crea tu cuenta en minutos y conecta tu facturación electrónica de forma segura.',
    icon: '1.',
  },
  {
    name: 'Selecciona tus facturas',
    description: 'Elige las facturas que deseas anticipar. Visualiza la tasa y el monto a recibir de forma transparente.',
    icon: '2.',
  },
  {
    name: 'Recibe tu dinero',
    description: 'Una vez aprobada la operación, recibe los fondos en tu cuenta en menos de 48 horas.',
    icon: '3.',
  },
];

export function HowItWorks() {
  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <h2 className="font-colette text-3xl font-bold tracking-tight text-lp-primary-1 sm:text-4xl">
          ¿Cómo funciona?
        </h2>
        <p className="mt-4 text-lg leading-8 text-lp-sec-3">
          Anticipar tus facturas nunca fue tan fácil. Tres simples pasos.
        </p>
      </div>
      <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-12">
        {steps.map((step) => (
          <Card
            key={step.name}
            className="text-center rounded-2xl border-lp-sec-1/40 bg-white"
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <span className="text-4xl font-bold font-colette text-lp-primary-1">
                  {step.icon}
                </span>
              </div>
              <h3 className="mt-5 font-colette text-xl font-semibold text-lp-primary-1">
                {step.name}
              </h3>
              <p className="mt-2 text-base text-lp-sec-3">{step.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
