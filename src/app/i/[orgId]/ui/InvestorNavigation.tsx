"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface InvestorNavigationProps {
  orgId: string;
}

export function InvestorNavigation({ orgId }: InvestorNavigationProps) {
  const pathname = usePathname();
  const basePath = `/i/${orgId}`;

  const items = [
    { href: `${basePath}/dashboard`, label: "Dashboard" },
    { href: `${basePath}/posiciones`, label: "Posiciones" },
    { href: `${basePath}/transacciones`, label: "Transacciones" },
    { href: `${basePath}/configuracion`, label: "Configuración" },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-3 border-b border-lp-gray-100 pb-4">
      {items.map((item) => {
        const isActive = pathname?.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-lp-primary-1 text-white shadow-sm"
                : "bg-white text-lp-primary-1 hover:bg-lp-primary-1/5"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
