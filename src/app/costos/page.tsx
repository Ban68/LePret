import { PricingExample } from '@/components/PricingExample';
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ShieldCheck, FileSearch, XCircle } from "lucide-react";

export default function CostosPage() {
  return (
    <div className="py-20 sm:py-32 bg-lp-primary-2/30">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="font-colette text-4xl font-bold tracking-tight text-lp-primary-1 sm:text-5xl">
            Transparencia Total
          </h1>
          <p className="mt-6 text-xl leading-8 text-lp-sec-3">
            Sabes exactamenante cuánto recibes desde el primer momento. <br className="hidden sm:inline" />
            <span className="font-semibold text-lp-primary-1">Sin letra pequeña ni sorpresas.</span>
          </p>
        </div>

        {/* Pricing Calculator Section */}
        <div className="mb-24">
          <PricingExample monto={10000000} plazo={30} />
        </div>

        {/* What drives the cost? */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
          <Card className="bg-white border-lp-sec-4/10 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-700" />
                </div>
                <h3 className="font-bold text-lg text-lp-primary-1">Valor Nominal</h3>
              </div>
              <p className="text-lp-sec-3">La tarifa se aplica como un porcentaje único sobre el valor total de la factura.</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-lp-sec-4/10 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <FileSearch className="h-6 w-6 text-blue-700" />
                </div>
                <h3 className="font-bold text-lg text-lp-primary-1">Plazo de Pago</h3>
              </div>
              <p className="text-lp-sec-3">A mayor tiempo de vencimiento, la tasa se ajusta proporcionalmente al riesgo temporal.</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-lp-sec-4/10 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-2 rounded-lg bg-yellow-100">
                  <ShieldCheck className="h-6 w-6 text-yellow-700" />
                </div>
                <h3 className="font-bold text-lg text-lp-primary-1">Riesgo del Pagador</h3>
              </div>
              <p className="text-lp-sec-3">Evaluamos la solidez de tu cliente (pagador) para ofrecerte la mejor tasa posible.</p>
            </CardContent>
          </Card>
        </div>

        {/* No Hidden Fees Badge */}
        <div className="bg-lp-primary-1 rounded-3xl p-8 sm:p-12 text-center text-white relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold font-colette mb-8">Lo que NO te cobramos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="flex flex-col items-center gap-3">
                <XCircle className="h-10 w-10 text-red-400" />
                <span className="font-medium">Sin estudio de crédito</span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <XCircle className="h-10 w-10 text-red-400" />
                <span className="font-medium">Sin comisión de desembolso</span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <XCircle className="h-10 w-10 text-red-400" />
                <span className="font-medium">Sin sanción por prepago</span>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-white/20">
              <p className="text-lg opacity-90">Solo pagas una tarifa única por el servicio de anticipo.</p>
            </div>
          </div>

          {/* Decorative opacity circles */}
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
        </div>

      </div>
    </div>
  );
}
