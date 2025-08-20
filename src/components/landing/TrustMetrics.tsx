import { cn } from "@/lib/utils";

const metrics = [
  { name: 'Facturas financiadas', value: '+1,200' },
  { name: 'Fondos desembolsados', value: '+$15M' },
  { name: 'Clientes satisfechos', value: '99%' },
  { name: 'Tiempo de aprobación', value: '<24h' },
];

interface TrustMetricsProps {
  backgroundClass?: string;
}

export function TrustMetrics({ backgroundClass = "" }: TrustMetricsProps) {
  return (

    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-x-8 gap-y-16 text-center lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.name}>
            <p className="font-colette text-4xl font-bold tracking-tight text-lp-primary-1">
              {metric.value}
            </p>
            <p className="mt-1 text-base leading-7 text-lp-sec-3">{metric.name}</p>
          </div>
        ))}

      </div>
    </div>
  );
}
