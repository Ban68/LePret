import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full bg-lp-primary-1 text-lp-primary-2">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* DE: flex justify-between items-center */}
        {/* A: grid 3 columnas para centrar el nav */}
        <div className="grid grid-cols-3 items-center h-14">
          {/* Columna 1: logo (izquierda) */}
          <div className="flex items-center justify-start">
            <Logo />
          </div>

          {/* Columna 2: NAV (centro absoluto) */}
          <nav aria-label="Main" className="hidden md:flex items-center justify-center">
            <ul className="flex gap-6 text-sm font-medium">
              <li><Link href="/#factoring" className="hover:opacity-90">Factoring</Link></li>
              <li><Link href="/#costos" className="hover:opacity-90">Costos</Link></li>
              <li><Link href="/#empresa" className="hover:opacity-90">Empresa</Link></li>
              <li><Link href="/#contacto" className="hover:opacity-90">Contacto</Link></li>
            </ul>
          </nav>

          {/* Columna 3: CTA (derecha) */}
          <div className="flex items-center justify-end">
            <Link href="/preaprobacion">
              <Button className="bg-lp-primary-2 text-lp-primary-1 hover:opacity-90">
                Generar oferta
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

