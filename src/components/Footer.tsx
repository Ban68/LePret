import Link from 'next/link';
import { Logo } from './Logo';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-lp-primary-2 border-t border-lp-sec-4/50">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-2">
              <Logo />
              <span className="font-colette text-xl font-bold text-lp-primary-1">LePrêt Capital</span>
            </Link>
            <p className="text-sm text-lp-sec-3">
              Liquidez inmediata para tus facturas electrónicas.
            </p>
          </div>
          <div>
            <h3 className="font-colette text-lg font-semibold text-lp-primary-1">Soluciones</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link href="/soluciones/factoring-electronico" className="text-lp-sec-3 hover:text-lp-primary-1">Factoring Electrónico</Link></li>
              <li><Link href="/soluciones/confirming" className="text-lp-sec-3 hover:text-lp-primary-1">Confirming (Próximamente)</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-colette text-lg font-semibold text-lp-primary-1">Legal</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link href="/legal/privacidad" className="text-lp-sec-3 hover:text-lp-primary-1">Política de Privacidad</Link></li>
              <li><Link href="/legal/terminos" className="text-lp-sec-3 hover:text-lp-primary-1">Términos y Condiciones</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-colette text-lg font-semibold text-lp-primary-1">Contacto</h3>
            <ul className="mt-4 space-y-2 text-sm text-lp-sec-3">
              <li>
                Email: <a href="mailto:info@lepretcapital.com" className="text-lp-sec-3 hover:text-lp-primary-1 transition-colors">info@lepretcapital.com</a>
              </li>
              <li>
                Teléfono: <a href="tel:+573162793379" className="text-lp-sec-3 hover:text-lp-primary-1 transition-colors">+57 316 2793379</a>
              </li>
              <li>Bogotá, Colombia</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-lp-sec-4/50 pt-8 text-center text-sm text-lp-sec-3">
          &copy; {currentYear} LePrêt Capital S.A.S. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
