'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type LinkInfo = {
  href: string;
  label: string;
};

export function ClientPortalNav({ links }: { links: LinkInfo[] }) {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex flex-wrap gap-2">
      {links.map((l) => {
        const isActive = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'rounded-md border border-lp-sec-4/60 px-3 py-1.5 text-sm text-lp-primary-1 transition-colors',
              {
                'bg-lp-primary-1 text-lp-primary-2': isActive,
                'hover:bg-lp-primary-1/90 hover:text-lp-primary-2': !isActive,
              }
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
