import {
  MousePointerClick,
  Timer,
  Globe2,
  ShieldCheck,
  FileText,
  LifeBuoy,
  type LucideIcon,
} from 'lucide-react';
import { cn } from "@/lib/utils";

const benefits: {
  name: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    name: 'Preaprobación Online',
    description:
      'Obtén una oferta preliminar en minutos, sin papeleo y 100% en línea.',
    icon: MousePointerClick,
  },
  {
    name: 'Fondos en 24-48h',
    description:
      'Accede a tu liquidez rápidamente una vez verificada la operación.',
    icon: Timer,
  },
  {
    name: 'Integrado a la DIAN',
    description:
      'Conectamos directamente con RADIAN para un proceso ágil y seguro.',
    icon: Globe2,
  },
  {
    name: 'No Afecta tu Crédito',
    description:
      'El factoring es una venta de activo, no una deuda. No consume tus cupos de crédito.',
    icon: ShieldCheck,
  },
  {
    name: 'Transparencia Total',
    description:
      'Conoce todos los costos desde el inicio. Sin letra pequeña ni sorpresas.',
    icon: FileText,
  },
  {
    name: 'Soporte Humano',
    description:
      'Nuestro equipo de expertos está disponible para ayudarte cuando lo necesites.',
    icon: LifeBuoy,
  },
];

interface BenefitsProps {
  backgroundClass?: string;
}

export function Benefits({ backgroundClass = "" }: BenefitsProps) {
  return (
    <section className={cn("py-20 sm:py-32", backgroundClass)}>
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
            <div
              key={benefit.name}
              tabIndex={0}
              className="flex items-start gap-4 rounded-lg transition hover:shadow-lg hover:-translate-y-1 focus-visible:shadow-lg focus-visible:-translate-y-1 outline-offset-2"
            >
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-lp-primary-2">
                <benefit.icon className="size-6 text-lp-primary-1" aria-hidden="true" />
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
