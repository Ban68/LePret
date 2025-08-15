import { ContactForm } from '@/components/forms/ContactForm';

export default function ContactoPage() {
  return (
    <div className="py-20 sm:py-24">
      <div className="container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="font-colette text-3xl font-bold tracking-tight text-lp-primary-1 sm:text-4xl">
            Contáctanos
          </h1>
          <p className="mt-4 text-lg leading-8 text-lp-sec-3">
            ¿Tienes preguntas o necesitas asesoría? Envíanos un mensaje.
          </p>
        </div>
        <div className="mt-16">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
