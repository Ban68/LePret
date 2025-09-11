import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Refresca la sesión si es necesario
  await supabase.auth.getSession();

  // Rutas del portal requieren sesión y pertenencia a la organización
  if (req.nextUrl.pathname.startsWith("/c/")) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // Validar pertenencia a la org de la URL
    const match = req.nextUrl.pathname.match(/^\/c\/([^\/]+)/);
    const orgId = match?.[1];
    if (orgId) {
      // Guardar cookie de "última organización" visitada
      res.cookies.set("last_org", orgId, { path: "/", maxAge: 60 * 60 * 24 * 90 });
      const { data, error } = await supabase
        .from("memberships")
        .select("company_id")
        .eq("company_id", orgId)
        .eq("status", "ACTIVE")
        .limit(1);
      if (error || !data || data.length === 0) {
        const url = req.nextUrl.clone();
        url.pathname = "/select-org";
        url.searchParams.set("reason", "no-membership");
        return NextResponse.redirect(url);
      }
    }
  }

  // Si la sesión existe y viene a /select-org, llevarlo a su última organización (si hay cookie)
  if (req.nextUrl.pathname === "/select-org") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const lastOrg = req.cookies.get("last_org")?.value;
    if (session && lastOrg) {
      const url = req.nextUrl.clone();
      url.pathname = `/c/${lastOrg}`;
      return NextResponse.redirect(url);
    }
  }

  // Backoffice: restringir /hq a emails autorizados
  if (req.nextUrl.pathname.startsWith("/hq")) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const allowed = (process.env.BACKOFFICE_ALLOWED_EMAILS || "").split(/[,\s]+/).filter(Boolean).map(s=>s.toLowerCase());
    const email = session?.user?.email?.toLowerCase();
    if (!session || (allowed.length && (!email || !allowed.includes(email)))) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", "/hq");
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  // Ejecutar middleware en el portal, en /select-org y en /hq para controles de acceso
  matcher: ["/c/:path*", "/select-org", "/hq/:path*"],
};
