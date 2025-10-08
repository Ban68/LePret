import { ReactNode } from "react";
import { supabaseServer } from "@/lib/supabase-server";
import { isBackofficeAllowed } from "@/lib/hq-auth";

interface HqAccessGateProps {
  children: ReactNode;
}

export async function HqAccessGate({ children }: HqAccessGateProps) {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAllowed = session ? await isBackofficeAllowed(session.user?.id, session.user?.email) : false;

  if (!isAllowed) {
    return (
      <div className="py-10">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            No tienes permiso para ver esta página.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
