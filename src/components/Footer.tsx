import Link from 'next/link';
import { Logo } from './Logo';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-lp-primary-1 text-lp-primary-2 border-t border-lp-primary-2/20">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-2">
              <Logo />
              <span className="font-colette text-xl font-bold">LePrêt Capital</span>
            </Link>
            <p className="text-sm text-lp-primary-2/80">
              Liquidez inmediata para tus facturas electrónicas.
            </p>
          </div>
          <div>
            <div className="flex h-10 items-center">
              <h3 className="font-colette text-lg font-semibold">Soluciones</h3>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link href="/soluciones/factoring-electronico" className="hover:underline">Factoring Electrónico</Link></li>
              <li><Link href="/soluciones/confirming" className="hover:underline">Confirming (Próximamente)</Link></li>
            </ul>
          </div>
          <div>
            <div className="flex h-10 items-center">
              <h3 className="font-colette text-lg font-semibold">Legal</h3>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link href="/legal/privacidad" className="hover:underline">Política de Privacidad</Link></li>
              <li><Link href="/legal/terminos" className="hover:underline">Términos y Condiciones</Link></li>
            </ul>
          </div>
          <div>
            <div className="flex h-10 items-center">
              <h3 className="font-colette text-lg font-semibold">Contacto</h3>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                Email: <a href="mailto:info@lepretcapital.com" className="hover:underline transition-colors">info@lepretcapital.com</a>
              </li>
              <li>
                Teléfono: <a href="tel:+573162793379" className="hover:underline transition-colors">+57 316 2793379</a>
              </li>
              <li>Santa Marta, Colombia</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-lp-primary-2/20 pt-8 text-center text-sm text-lp-primary-2/70">
          &copy; {currentYear} LePrêt Capital S.A.S. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
