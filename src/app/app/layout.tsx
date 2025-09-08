"use client";

import ClientAuthGuard from "@/components/auth/ClientAuthGuard";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseBrowser();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <ClientAuthGuard>
      <div className="min-h-screen">
        <header className="border-b bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex items-center justify-between px-4 py-3">
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/app" className="hover:underline">Dashboard</Link>
              <Link href="/app/operaciones" className="hover:underline">Operaciones</Link>
              <Link href="/app/operaciones/nueva" className="hover:underline">Nueva Operación</Link>
            </nav>
            <Button size="sm" variant="outline" onClick={signOut}>Salir</Button>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </ClientAuthGuard>
  );
}

