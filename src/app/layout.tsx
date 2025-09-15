import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next"

// Font configuration
const colette = localFont({
  src: [
    { path: "../../public/fonts/colette/Colette-Bold.otf", weight: "700", style: "normal" },
    { path: "../../public/fonts/colette/Colette-Regular.otf", weight: "400", style: "normal" },
  ],
  variable: "--font-colette",
  display: "swap",
});

const kollektif = localFont({
  src: [
    { path: "../../public/fonts/kollektif/Kollektif.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/kollektif/Kollektif-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-kollektif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LePrêt Capital | Liquidez inmediata para tus facturas",
  description: "Proceso 100% en línea. Preaprobación en minutos. Desembolso ágil. Sin afectar tu capacidad de crédito.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${colette.variable} ${kollektif.variable}`} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
