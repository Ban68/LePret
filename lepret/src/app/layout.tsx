import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

// Font configuration
const colette = localFont({
  src: [
    { path: '../../public/fonts/colette/Colette-Thin.otf', weight: '100', style: 'normal' },
    { path: '../../public/fonts/colette/Colette-Light.otf', weight: '300', style: 'normal' },
    { path: '../../public/fonts/colette/Colette-Regular.otf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/colette/Colette-LightItalic.otf', weight: '300', style: 'italic' },
    { path: '../../public/fonts/colette/Colette-Bold.otf', weight: '700', style: 'normal' },
    { path: '../../public/fonts/colette/Colette-BoldItalic.otf', weight: '700', style: 'italic' },
    { path: '../../public/fonts/colette/Colette-Black.otf', weight: '900', style: 'normal' },
    { path: '../../public/fonts/colette/Colette-BlackItalic.otf', weight: '900', style: 'italic' },
  ],
  variable: '--font-colette',
  display: 'swap',
});

const kollektif = localFont({
  src: [
    { path: '../../public/fonts/kollektif/Kollektif.ttf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/kollektif/Kollektif-Italic.ttf', weight: '400', style: 'italic' },
    { path: '../../public/fonts/kollektif/Kollektif-Bold.ttf', weight: '700', style: 'normal' },
    { path: '../../public/fonts/kollektif/Kollektif-BoldItalic.ttf', weight: '700', style: 'italic' },
  ],
  variable: '--font-kollektif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "LePrêt Capital | Liquidez inmediata para tus facturas",
  description: "Proceso 100% en línea. Preaprobación en minutos. Desembolso ágil. Sin afectar tu capacidad de crédito.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${colette.variable} ${kollektif.variable} antialiased`}>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
