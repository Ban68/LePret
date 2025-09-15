"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';

import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, usePathname } from 'next/navigation';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClientComponentClient();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = 'hidden';
    };

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  useEffect(() => {
    getSession().then(setSession);
    setOrgId(getLastOrgId());
  }, []);

  const navLinks = [
    { href: "/soluciones/factoring-electronico", label: "Factoring" },
    { href: "/costos", label: "Costos" },
    { href: "/empresa", label: "Empresa" },
    { href: "/contacto", label: "Contacto" },
    { href: "/login?redirectTo=/select-org", label: "Portal" },
  ];

  const avatarUrl =
    (session?.user.user_metadata as Record<string, string> | undefined)?.avatar_url ||
    (session?.user.user_metadata as Record<string, string> | undefined)?.picture ||
    undefined;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-lp-sec-4/50 bg-lp-primary-1 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-start px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center space-x-2" onClick={() => setIsMenuOpen(false)}>
            <Logo />
            <Image src="/LePretSinFondo.png" alt="LePrêt Capital" width={281} height={281} className="mt-[-15px]" />
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden items-center space-x-4 md:flex ml-36">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname === link.href.split('?')[0];
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-lp-primary-2 text-lp-primary-1' : 'text-lp-primary-2 hover:bg-lp-primary-2 hover:text-lp-primary-1'}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center space-x-4 ml-auto">
            {session ? (
              <>
                {orgId && (
                  <Link
                    href={`/c/${orgId}`}
                    className="hidden md:block rounded-md px-3 py-2 text-sm font-medium text-lp-primary-2 transition-colors hover:bg-lp-primary-2 hover:text-lp-primary-1"
                  >
                    Mi organización
                  </Link>
                )}
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Avatar"
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lp-primary-2 text-lp-primary-1">
                    {session.user.email?.[0]?.toUpperCase()}
                  </span>
                )}
              </>
            ) : (
              <div className="hidden md:block">
                <Button
                  asChild
                  className="bg-lp-primary-2 text-lp-primary-1 hover:opacity-90"
                >
                  <Link href="/preaprobacion">Conocer mi cupo</Link>
                </Button>
              </div>
            )}

            <div className="hidden md:block">
              <Button onClick={signOut} variant="outline" className="border-lp-sec-4/60 text-lp-primary-2">
                Salir
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
            >
              <svg
                className="h-6 w-6 text-lp-primary-2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16m-7 6h7" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <>
          <div
            className="fixed inset-0 top-16 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMenuOpen(false)}
          />
          <div
            id="mobile-menu"
            className="md:hidden fixed top-16 left-0 w-full bg-lp-primary-2/95 backdrop-blur-sm shadow-lg z-50"
          >
            <nav className="container mx-auto flex flex-col items-center space-y-4 py-8">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname === link.href.split('?')[0];
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`w-full rounded-md px-4 py-2 text-lg font-medium transition-colors ${isActive ? 'bg-lp-primary-1 text-lp-primary-2' : 'text-lp-primary-1 hover:bg-lp-primary-1/10'}`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <Button
                asChild
                className="mt-4 bg-lp-primary-1 text-lp-primary-2 hover:opacity-90"
              >

                <Link href="/preaprobacion" onClick={() => setIsMenuOpen(false)}>
                  Conocer mi cupo
                </Link>
              </Button>

              <Button onClick={() => { setIsMenuOpen(false); signOut(); }} variant="outline" className="border-lp-primary-1/40 text-lp-primary-1">
                Salir
              </Button>
            </nav>
          </div>
        </>

      )}
    </>
  );
}
