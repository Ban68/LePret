import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-lp-sec-4/50 bg-lp-primary-2/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-2">
          <Logo />
          <span className="font-colette text-xl font-bold text-lp-primary-1">
            LePrêt Capital
          </span>
        </Link>
        <nav className="hidden items-center space-x-6 md:flex">
          <Link href="/soluciones/factoring-electronico" className="text-sm font-medium text-lp-primary-1/80 transition-colors hover:text-lp-primary-1">
            Factoring
          </Link>
          <Link href="/costos" className="text-sm font-medium text-lp-primary-1/80 transition-colors hover:text-lp-primary-1">
            Costos
          </Link>
          <Link href="/empresa" className="text-sm font-medium text-lp-primary-1/80 transition-colors hover:text-lp-primary-1">
            Empresa
          </Link>
          <Link href="/contacto" className="text-sm font-medium text-lp-primary-1/80 transition-colors hover:text-lp-primary-1">
            Contacto
          </Link>
        </nav>
        <div className="flex items-center space-x-4">
          <Button asChild>
            <Link href="/preaprobacion">Conocer mi cupo</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
