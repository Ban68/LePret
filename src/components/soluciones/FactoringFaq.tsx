import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "¿Qué es factoring electrónico?",
    answer: "Es un mecanismo de financiamiento que permite a las empresas obtener liquidez inmediata vendiendo sus facturas electrónicas por cobrar a una entidad financiera como LePrêt Capital.",
  },
  {
    question: "¿Afecta mi endeudamiento?",
    answer: "No. El factoring es una operación de venta de un activo (la factura), no una deuda. Por lo tanto, no afecta tu capacidad de endeudamiento ni tus cupos de crédito con otras entidades.",
  },
  {
    question: "¿Cuáles son los tiempos de desembolso?",
    answer: "Una vez que tu empresa está registrada y la operación es verificada, el desembolso de los fondos se realiza típicamente en un plazo de 24 a 48 horas hábiles.",
  },
  {
    question: "¿Qué necesito para empezar?",
    answer: "Ser una empresa legalmente constituida en Colombia, facturar electrónicamente a otras empresas (B2B), y tener un historial de facturación. El proceso de registro es 100% en línea.",
  },
  {
    question: "¿Qué pasa si el pagador de la factura no paga a tiempo?",
    answer: "Nuestra gestión de cobro se encarga del seguimiento con el pagador. Dependiendo del tipo de factoring, la responsabilidad final puede variar, pero siempre buscamos una solución amigable.",
  },
];

interface FaqProps {
  backgroundClass?: string;
}

export function FactoringFaq({ backgroundClass = "" }: FaqProps) {
  return (
    <section className={cn("py-20 sm:py-32", backgroundClass)}>
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-colette text-3xl font-bold tracking-tight text-lp-primary-1 sm:text-4xl">
            Preguntas Frecuentes
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full mt-16">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left font-semibold text-lg">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-base text-lp-sec-3">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
