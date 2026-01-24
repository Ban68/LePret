"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

type LinkItem = { href: string; label: string };

type Props = { links: LinkItem[] };

export function ClientPortalNav({ links }: Props) {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex flex-wrap gap-2">
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              isActive
                ? "border-lp-primary-1 bg-lp-primary-1 text-lp-primary-2"
                : "border-lp-sec-4/60 text-lp-primary-1 hover:bg-lp-primary-1 hover:text-lp-primary-2"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
