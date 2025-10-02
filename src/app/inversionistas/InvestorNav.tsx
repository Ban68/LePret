"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type InvestorNavItem = {
  href: string;
  label: string;
};

export function InvestorNav({ items }: { items: InvestorNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-lp-sec-5/30 bg-white/80 backdrop-blur">
      <div className="container mx-auto flex max-w-6xl items-center gap-6 px-4 py-4">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-medium transition-colors",
                isActive
                  ? "text-lp-primary-1"
                  : "text-lp-sec-4 hover:text-lp-primary-1"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
