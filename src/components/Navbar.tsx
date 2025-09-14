"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
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
    if (!isMenuOpen) return;

    const menu = menuRef.current;
    const focusable = menu?.querySelectorAll<HTMLElement>('a, button') || [];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      } else if (event.key === "Tab" && focusable.length > 0) {
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menu &&
        !menu.contains(event.target as Node) &&
        !toggleButtonRef.current?.contains(event.target as Node)
      ) {
        closeMenu();
      }

    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    first?.focus();

    return () => {

      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);

    };
  }, [isMenuOpen]);

  const navLinks = [
    { href: "/soluciones/factoring-electronico", label: "Factoring" },
    { href: "/costos", label: "Costos" },
    { href: "/empresa", label: "Empresa" },
    { href: "/contacto", label: "Contacto" },
    { href: "/login?redirectTo=/select-org", label: "Portal" },
  ];

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
            <div className="hidden md:block">
              <Button
                asChild
                className="bg-lp-primary-2 text-lp-primary-1 hover:opacity-90"
              >
                <Link href="/preaprobacion">Conocer mi cupo</Link>
              </Button>
            </div>

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
              ref={toggleButtonRef}
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
