import Image from "next/image";
import { cn } from "@/lib/utils";

const allies = [
  { src: "/file.svg", alt: "Colombia Fintech" },
  { src: "/window.svg", alt: "ISO 27001 (en proceso)" },
  { src: "/globe.svg", alt: "RADIAN-ready" },
  { src: "/next.svg", alt: "Superintendencia de Sociedades" },
  { src: "/vercel.svg", alt: "CCB" },
];

interface AlliesProps {
  backgroundClass?: string;
}

export function Allies({ backgroundClass = "" }: AlliesProps) {
  return (
    <section className={cn("py-20 sm:py-24", backgroundClass)}>
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-colette text-2xl font-semibold leading-8 text-lp-primary-1">
          Con la confianza y el respaldo de
        </h2>
        <div className="mx-auto mt-10 grid max-w-lg grid-cols-2 items-center gap-x-8 gap-y-10 sm:max-w-xl sm:grid-cols-3 lg:mx-0 lg:max-w-none">
          {allies.map((ally) => (
            <div key={ally.alt} className="flex justify-center">
              <Image
                src={ally.src}
                alt={ally.alt}
                width={120}
                height={60}
                loading="lazy"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 120px"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
