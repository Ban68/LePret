export default function FactoringElectronicoPage() {
  return (
    <div className="py-20 sm:py-24">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-colette text-3xl font-bold tracking-tight text-lp-primary-1 sm:text-4xl text-center">
          Factoring Electrónico
        </h1>
        <div className="mt-10 text-lg leading-8 text-lp-sec-3 space-y-6">
          <p>
            El factoring electrónico es una solución financiera innovadora que permite a las empresas transformar sus facturas electrónicas por cobrar en liquidez inmediata. En LePrêt Capital, te ofrecemos un proceso ágil, transparente y 100% en línea para que accedas a los fondos que necesitas sin afectar tu capacidad de endeudamiento.
          </p>
          <h2 className="font-colette text-2xl font-bold text-lp-primary-1 mt-8">
            ¿Cómo funciona?
          </h2>
          <p>
            Simplemente cargas tus facturas electrónicas (DIAN/RADIAN) en nuestra plataforma, nosotros las analizamos y te ofrecemos una propuesta. Una vez aceptada, los fondos se desembolsan en tu cuenta en un plazo de 24 a 48 horas.
          </p>
          <h2 className="font-colette text-2xl font-bold text-lp-primary-1 mt-8">
            Requisitos
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Empresa legalmente constituida en Colombia.</li>
            <li>Facturación electrónica a otras empresas (B2B).</li>
            <li>Facturas emitidas a pagadores con buen historial crediticio.</li>
          </ul>
          <h2 className="font-colette text-2xl font-bold text-lp-primary-1 mt-8">
            Preguntas Frecuentes
          </h2>
          <p>
            (Aquí se podría integrar un componente de FAQ específico para factoring, o enlazar a la sección de FAQ general).
          </p>
        </div>
      </div>
    </div>
  );
}
