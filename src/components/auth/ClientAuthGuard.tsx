"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function ClientAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const hasSession = Boolean(data.session);
      if (!hasSession) {
        router.replace("/login");
      } else {
        setChecking(false);
      }
    });
    return () => {
      active = false;
    };
  }, [router, supabase]);

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Verificando sesión...
      </div>
    );
  }

  return <>{children}</>;
}

