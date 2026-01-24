import { Card, CardContent } from "@/components/ui/card";
import { Users, Target, Rocket, Award, Linkedin } from "lucide-react";

export default function EmpresaPage() {
  const team = [
    { name: "Andrés Méndez", role: "CEO & Co-Fundador", bio: "15+ años en banca corporativa y fintech." },
    { name: "Diana Torres", role: "CTO", bio: "Experta en arquitectura de software y blockchain." },
    { name: "Carlos Ruiz", role: "Director Financiero", bio: "Especialista en riesgo y estructuración de deuda." },
    { name: "Maria L. Gómez", role: "Gerente Comercial", bio: "Líder en estrategias de crecimiento B2B." },
  ];

  return (
    <div className="py-20 sm:py-32 bg-lp-primary-2/30">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h1 className="font-colette text-4xl font-bold tracking-tight text-lp-primary-1 sm:text-5xl">
            Impulsando el Crecimiento
          </h1>
          <p className="mt-6 text-xl leading-8 text-lp-sec-3">
            En LePrêt Capital, transformamos el acceso a liquidez para las PYMES colombianas con tecnología, transparencia y agilidad.
          </p>
        </div>

        {/* Mission / Vision Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
          <Card className="border-none shadow-soft hover:shadow-card bg-white">
            <CardContent className="p-8 flex flex-col items-center text-center h-full justify-center">
              <div className="h-16 w-16 rounded-full bg-lp-primary-1/10 flex items-center justify-center mb-6">
                <Rocket className="h-8 w-8 text-lp-primary-1" />
              </div>
              <h2 className="text-2xl font-bold font-colette text-lp-primary-1 mb-4">Nuestra Misión</h2>
              <p className="text-lp-sec-3 text-lg">
                Democratizar el factoring en Colombia, eliminando la burocracia para que los empresarios se enfoquen en lo que mejor saben hacer: <span className="font-semibold text-lp-primary-1">crecer</span>.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-soft hover:shadow-card bg-white">
            <CardContent className="p-8 flex flex-col items-center text-center h-full justify-center">
              <div className="h-16 w-16 rounded-full bg-lp-primary-1/10 flex items-center justify-center mb-6">
                <Target className="h-8 w-8 text-lp-primary-1" />
              </div>
              <h2 className="text-2xl font-bold font-colette text-lp-primary-1 mb-4">Nuestro Propósito</h2>
              <p className="text-lp-sec-3 text-lg">
                Ser el aliado financiero número uno de las PYMES, ofreciendo soluciones de capital de trabajo justas, rápidas y 100% digitales.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Team Grid */}
        <div className="mb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold font-colette text-lp-primary-1 mb-4">Nuestro Equipo</h2>
            <p className="text-lp-sec-3 max-w-2xl mx-auto">
              Un equipo multidisciplinario uniendo lo mejor de la banca tradicional y la innovación tecnológica.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member) => (
              <Card key={member.name} className="border-none shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-0">
                  <div className="h-48 bg-lp-sec-4/20 w-full flex items-center justify-center rounded-t-xl">
                    <Users className="h-16 w-16 text-lp-sec-4/40" />
                  </div>
                  <div className="p-6 text-center">
                    <h3 className="font-bold text-lg text-lp-primary-1">{member.name}</h3>
                    <p className="text-sm font-semibold text-lp-primary-1/80 mb-2">{member.role}</p>
                    <p className="text-xs text-lp-sec-3 mb-4">{member.bio}</p>
                    <button className="text-lp-primary-1 hover:text-lp-primary-1/70 transition-colors">
                      <Linkedin className="h-5 w-5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Trust Seal */}
        <div className="bg-lp-primary-1 rounded-3xl p-8 sm:p-12 text-center text-white relative overflow-hidden">
          <div className="relative z-10 max-w-3xl mx-auto">
            <div className="inline-flex p-3 rounded-full bg-white/10 mb-6">
              <Award className="h-8 w-8 text-yellow-400" />
            </div>
            <h2 className="text-3xl font-bold font-colette mb-6">Sello de Confianza</h2>
            <p className="text-lg opacity-90 leading-relaxed">
              Operamos bajo la estricta regulación colombiana y contamos con el respaldo de aliados estratégicos de primer nivel.
              Tu seguridad y transparencia son innegociables para nosotros.
            </p>
          </div>
          {/* Decorative particles */}
          <div className="absolute top-10 left-10 w-2 h-2 bg-yellow-400 rounded-full opacity-50"></div>
          <div className="absolute bottom-10 right-20 w-3 h-3 bg-white rounded-full opacity-30"></div>
        </div>

      </div>
    </div>
  );
}
