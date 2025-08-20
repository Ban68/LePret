import Image from "next/image"
import { Btn } from "@/components/ui/btn"
import { Section } from "@/components/layout/Section"

export default function Hero() {
  return (
    <Section className="bg-lp-primary2">
      <div className="py-16 md:py-24 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="h1">Liquidez inmediata para tus <span className="whitespace-nowrap">facturas electrónicas</span></h1>
          <p className="lead mt-4">Proceso 100% en línea. Preaprobación en minutos. Desembolso ágil. Sin afectar tu capacidad de crédito.</p>
          <ul className="mt-6 space-y-2 text-neutral-700">
            <li>• Conectado a facturación electrónica (DIAN/RADIAN)</li>
            <li>• Fondos en 24–48 horas</li>
            <li>• Transparencia y costos claros</li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Btn>Conocer mi cupo</Btn>
            <Btn variant="ghost">Hablar con un asesor →</Btn>
          </div>
        </div>

        <div className="relative">
          {/* Fondo suave detrás de la imagen */}
          <div className="absolute inset-6 -z-10 rounded-3xl bg-lp-sec4/70 blur-2xl" />
          <div className="rounded-3xl border border-lp-sec1/40 bg-white shadow-card overflow-hidden">
            <Image
              src="/liquidez.png"   // tu imagen en /public
              alt="Liquidez, agilidad y simplicidad"
              width={1200}
              height={700}
              className="w-full h-auto"
              priority
            />
          </div>
        </div>
      </div>
    </Section>
  )
}
