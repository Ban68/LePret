import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function Hero() {
  return (
    <section className="py-20 sm:py-32 bg-lp-primary-2">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="font-colette text-4xl font-bold tracking-tight text-lp-primary-1 sm:text-5xl lg:text-6xl">
          Liquidez inmediata para tus facturas electrónicas
        </h1>
        <p className="mt-6 text-lg leading-8 text-lp-sec-3 max-w-2xl mx-auto">
          Proceso 100% en línea. Preaprobación en minutos. Desembolso ágil. Sin afectar tu capacidad de crédito.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Button asChild size="lg">
            <Link href="/preaprobacion">Conocer mi cupo</Link>
          </Button>
          <Button asChild variant="link" className="text-lp-primary-1">
            <Link href="/contacto">Hablar con un asesor <span aria-hidden="true">→</span></Link>
          </Button>
        </div>
        <div className="mt-16 flow-root">
            {/* Placeholder for mockup dashboard */}
            <div className="rounded-2xl bg-lp-sec-4 p-2 ring-1 ring-inset ring-lp-sec-1/10 lg:p-4">
                <div className="bg-white rounded-xl shadow-2xl ring-1 ring-gray-900/10 h-96 flex items-center justify-center">
                    <p className="text-lp-sec-1">Dashboard Mockup</p>
                </div>
            </div>
        </div>
      </div>
    </section>
  );
}
