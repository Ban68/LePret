export default function PrivacidadPage() {
  return (
    <div className="py-20 sm:py-24">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-colette text-3xl font-bold tracking-tight text-lp-primary-1 sm:text-4xl text-center">
          Política de Tratamiento de Datos
        </h1>
        <div className="mt-10 text-lg leading-8 text-lp-sec-3 space-y-6">
          <p>
            En LePrêt Capital S.A.S., valoramos y respetamos su privacidad. Esta política describe cómo recopilamos, usamos y protegemos su información personal de acuerdo con la legislación colombiana vigente.
          </p>
          <h2 className="font-colette text-2xl font-bold text-lp-primary-1 mt-8">
            Información que Recopilamos
          </h2>
          <p>
            Recopilamos información que usted nos proporciona directamente al utilizar nuestros servicios, como su nombre, NIT, razón social, información de contacto (email, teléfono) y datos relacionados con sus operaciones de factoring.
          </p>
          <h2 className="font-colette text-2xl font-bold text-lp-primary-1 mt-8">
            Uso de la Información
          </h2>
          <p>
            Utilizamos su información para:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>Procesar sus solicitudes de factoring y preaprobación.</li>
            <li>Comunicarnos con usted sobre nuestros servicios.</li>
            <li>Mejorar y personalizar su experiencia en nuestra plataforma.</li>
            <li>Cumplir con nuestras obligaciones legales y regulatorias.</li>
          </ul>
          <h2 className="font-colette text-2xl font-bold text-lp-primary-1 mt-8">
            Protección de Datos
          </h2>
          <p>
            Implementamos medidas de seguridad técnicas y administrativas para proteger su información contra el acceso no autorizado, la alteración, divulgación o destrucción.
          </p>
          <h2 className="font-colette text-2xl font-bold text-lp-primary-1 mt-8">
            Derechos del Titular
          </h2>
          <p>
            Usted tiene derecho a conocer, actualizar, rectificar y suprimir sus datos personales. Para ejercer estos derechos, puede contactarnos a través de [email de contacto].
          </p>
          <p>
            Esta política puede ser actualizada periódicamente. Le invitamos a revisarla con regularidad.
          </p>
        </div>
      </div>
    </div>
  );
}
