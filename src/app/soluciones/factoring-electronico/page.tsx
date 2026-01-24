import Link from "next/link";
import { Upload, FileCheck, Banknote, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function FactoringElectronicoPage() {
  return (
    <div className="py-20 sm:py-32 bg-lp-primary-2/30">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h1 className="font-colette text-4xl font-bold tracking-tight text-lp-primary-1 sm:text-5xl">
            Factoring Electrónico
          </h1>
          <p className="mt-6 text-xl leading-8 text-lp-sec-3">
            Transforma tus facturas por cobrar en <span className="font-semibold text-lp-primary-1">liquidez inmediata</span>.
            Sin endeudamiento, 100% digital y transparente.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button asChild size="lg" className="bg-lp-primary-1 text-white hover:bg-lp-primary-1/90 px-8">
              <Link href="/preaprobacion">
                Conocer mi cupo <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* How it Works Grid */}
        <div className="mb-24">
          <h2 className="text-3xl font-bold text-center text-lp-primary-1 font-colette mb-12">¿Cómo funciona?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-none shadow-soft hover:shadow-card transition-all duration-300">
              <CardContent className="pt-8 text-center flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-lp-primary-1/10 flex items-center justify-center mb-6">
                  <Upload className="h-8 w-8 text-lp-primary-1" />
                </div>
                <h3 className="text-xl font-bold text-lp-primary-1 mb-3">1. Carga</h3>
                <p className="text-lp-sec-3">Sube tus facturas electrónicas (XML) a nuestra plataforma segura.</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-soft hover:shadow-card transition-all duration-300">
              <CardContent className="pt-8 text-center flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-lp-primary-1/10 flex items-center justify-center mb-6">
                  <FileCheck className="h-8 w-8 text-lp-primary-1" />
                </div>
                <h3 className="text-xl font-bold text-lp-primary-1 mb-3">2. Oferta</h3>
                <p className="text-lp-sec-3">Recibe una propuesta transparente con el costo y valor a recibir.</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-soft hover:shadow-card transition-all duration-300">
              <CardContent className="pt-8 text-center flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-lp-primary-1/10 flex items-center justify-center mb-6">
                  <Banknote className="h-8 w-8 text-lp-primary-1" />
                </div>
                <h3 className="text-xl font-bold text-lp-primary-1 mb-3">3. Desembolso</h3>
                <p className="text-lp-sec-3">Acepta y recibe los fondos en tu cuenta bancaria en horas.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Requirements Section */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-lp-sec-4/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-lp-primary-1 font-colette mb-6">Requisitos Simples</h2>
              <p className="text-lp-sec-3 mb-8 text-lg">
                Diseñamos un proceso sin fricción para que te enfoques en tu negocio, no en papeleo.
              </p>
              <ul className="space-y-4">
                {[
                  "Empresa legalmente constituida en Colombia",
                  "Facturación electrónica B2B",
                  "Ventas a crédito a pagadores sólidos",
                  "Sin reportes negativos graves en centrales"
                ].map((req, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                    <span className="text-lp-primary-1 font-medium">{req}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-lp-primary-2/50 rounded-2xl p-8 flex items-center justify-center">
              <div className="text-center">
                <p className="text-5xl font-bold text-lp-primary-1 mb-2">100%</p>
                <p className="text-xl text-lp-sec-3 font-medium">Digital</p>
                <div className="w-16 h-1 bg-lp-primary-1 mx-auto my-6 opacity-20"></div>
                <p className="text-5xl font-bold text-lp-primary-1 mb-2">24h</p>
                <p className="text-xl text-lp-sec-3 font-medium">Aprobación promedio</p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Link */}
        <div className="mt-16 text-center">
          <Link href="/#faq" className="text-lp-primary-1 font-semibold hover:text-lp-primary-1/80 hover:underline transition-all">
            ¿Tienes dudas? Revisa nuestras Preguntas Frecuentes
          </Link>
        </div>

      </div>
    </div>
  );
}
