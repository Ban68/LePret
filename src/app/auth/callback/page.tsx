"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { isStaffUser } from "@/lib/staff";

export default function AuthCallbackPage() {
  const router = useRouter();
  const search = useSearchParams();
  const code = search.get("code");
  const redirectTo = search.get("redirectTo");

  useEffect(() => {
    const supabase = createClientComponentClient();
    let active = true;

    const processMagicLink = async () => {
      if (!code) {
        if (!active) return;
        router.replace(redirectTo ?? "/login");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("Failed to exchange OTP code", error);
        if (!active) return;
        router.replace("/login");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let destination = redirectTo ?? "/select-org";
      if (!redirectTo && user?.id) {
        const staff = await isStaffUser(supabase, user.id);
        destination = staff ? "/hq" : "/select-org";
      }

      if (!active) return;
      router.replace(destination);
    };

    processMagicLink();

    return () => {
      active = false;
    };
  }, [router, code, redirectTo]);

  return (
    <div className="py-20 sm:py-24">
      <div className="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
        <p className="text-lp-sec-3">Procesando acceso...</p>
      </div>
    </div>
  );
}
