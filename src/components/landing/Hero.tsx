import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/layout/Section';

export function Hero() {
  return (
    <Section className="py-20 sm:py-32 bg-lp-primary-2 text-center">
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
        <div className="rounded-2xl bg-lp-sec-4 p-2 ring-1 ring-inset ring-lp-sec-1/10 lg:p-4">
          <div className="bg-white rounded-xl shadow-2xl ring-1 ring-gray-900/10 h-96 overflow-hidden">
            <Image
              src="/liquidez.png"
              alt="Dashboard Mockup"
              width={1024}
              height={768}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </Section>
  );
}
