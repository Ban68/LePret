"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  { href: "/hq", label: "Resumen" },
  { href: "/hq/operaciones", label: "Operaciones" },
  { href: "/hq/riesgo", label: "Riesgo" },
  { href: "/hq/kpi", label: "KPIs" },
  { href: "/hq/configuracion", label: "Configuracion" },
  { href: "/hq/kyc", label: "Verificaciones KYC" },
  { href: "/hq/inversionistas", label: "Inversionistas" },
  { href: "/hq/usuarios", label: "Usuarios" },
];

export function HqNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones del HQ" className="border-b border-lp-sec-6">
      <ul className="-mb-px flex flex-wrap gap-4 text-sm font-medium text-lp-sec-4">
        {links.map((link) => {
          const isActive =
            pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "inline-flex items-center border-b-2 border-transparent pb-2 transition-colors",
                  isActive
                    ? "border-lp-primary-1 text-lp-primary-1"
                    : "hover:border-lp-sec-5 hover:text-lp-sec-2",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
