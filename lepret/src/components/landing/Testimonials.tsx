import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const testimonials = [
  {
    quote: "La rapidez y simpleza del proceso nos sorprendió. En 48 horas teníamos los fondos. Totalmente recomendados.",
    name: "Ana García",
    company: "CEO, Manufacturas ABC",
  },
  {
    quote: "El factoring con LePrêt nos ha permitido gestionar nuestro flujo de caja de manera mucho más eficiente. La plataforma es muy intuitiva.",
    name: "Carlos Rodríguez",
    company: "CFO, Logística Express",
  },
  {
    quote: "Excelente servicio y tasas competitivas. El no consumir cupo de crédito fue clave para nosotros. Un gran aliado.",
    name: "Sofía Gómez",
    company: "Gerente, Servicios Industriales",
  },
];

export function Testimonials() {
  return (
    <section className="py-20 sm:py-32 bg-lp-sec-4">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-colette text-3xl font-bold tracking-tight text-lp-primary-1 sm:text-4xl">
            Lo que dicen nuestros clientes
          </h2>
        </div>
        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full max-w-4xl mx-auto mt-16"
        >
          <CarouselContent>
            {testimonials.map((testimonial, index) => (
              <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
                <div className="p-1">
                  <Card className="bg-lp-primary-2 border-lp-sec-1/20 shadow-lg">
                    <CardContent className="flex flex-col items-start p-6">
                      <p className="text-base text-lp-sec-3 italic">"{testimonial.quote}"</p>
                      <div className="mt-4">
                        <p className="font-bold text-lp-primary-1">{testimonial.name}</p>
                        <p className="text-sm text-lp-sec-3">{testimonial.company}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </section>
  );
}
