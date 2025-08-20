"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';
import Image from 'next/image';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("keydown", handleEsc);
    };

    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isMenuOpen]);

  const navLinks = [
    { href: "/soluciones/factoring-electronico", label: "Factoring" },
    { href: "/costos", label: "Costos" },
    { href: "/empresa", label: "Empresa" },
    { href: "/contacto", label: "Contacto" },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-lp-sec-4/50 bg-lp-primary-1 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center space-x-2" onClick={() => setIsMenuOpen(false)}>
            <Logo />
            <Image src="/LePretSinFondo.png" alt="LePrêt Capital" width={281} height={281} className="mt-[-15px]" />
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden items-center space-x-6 md:flex">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm font-medium text-lp-primary-2/80 transition-colors hover:text-lp-primary-2">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-4">
            <div className="hidden md:block">
              <Button asChild className="text-lp-primary-2">
                <Link href="/preaprobacion">Conocer mi cupo</Link>
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
        <div
          id="mobile-menu"
          className="md:hidden absolute top-16 left-0 w-full bg-lp-primary-2/95 backdrop-blur-sm shadow-lg z-40"
        >
          <nav className="container mx-auto flex flex-col items-center space-y-4 py-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-lg font-medium text-lp-primary-2 transition-colors hover:text-lp-sec-3"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Button asChild className="mt-4">
              <Link href="/preaprobacion" onClick={() => setIsMenuOpen(false)}>Conocer mi cupo</Link>
            </Button>
          </nav>
        </div>
      )}
    </>
  );
}