import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

import { isInvestorAllowed } from "@/lib/hq-auth";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Refresh session if needed
  await supabase.auth.getSession();

  // Customer portal access: require session; allow staff to bypass membership
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

    const match = req.nextUrl.pathname.match(/^\/c\/([^\/]+)/);
    const orgId = match?.[1];
    if (orgId) {
      // Remember last org visited
      res.cookies.set("last_org", orgId, { path: "/", maxAge: 60 * 60 * 24 * 90 });

      // Staff bypass
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_staff")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (prof?.is_staff) {
        return res;
      }

      // Otherwise require membership in the org
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

  // If session exists and goes to /select-org, redirect to last org
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

  // Investor portal: require authenticated investor membership
  if (req.nextUrl.pathname.startsWith("/inversionistas")) {
    const targetPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("redirectTo", targetPath);
      return NextResponse.redirect(url);
    }

    const allowed = await isInvestorAllowed(session.user.id, session.user.email);
    if (!allowed) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("redirectTo", targetPath);
      url.searchParams.set("reason", "forbidden");
      return NextResponse.redirect(url);
    }
  }

  // Backoffice: restrict /hq to staff or allowlisted emails
  if (req.nextUrl.pathname.startsWith("/hq")) {
    const isLoginRoute = req.nextUrl.pathname.startsWith("/hq/login");
    const targetPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      if (!isLoginRoute) {
        const url = req.nextUrl.clone();
        url.pathname = "/hq/login";
        url.search = "";
        url.searchParams.set("redirectTo", targetPath);
        return NextResponse.redirect(url);
      }
      return res;
    }

    const email = session.user?.email?.toLowerCase();
    const allowed = (process.env.BACKOFFICE_ALLOWED_EMAILS || "")
      .split(/[ ,\n\t]+/)
      .filter(Boolean)
      .map((s) => s.toLowerCase());

    let isStaff = false;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_staff")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (!profileError) {
      isStaff = Boolean(profile?.is_staff);
    }

    const emailAllowed = !allowed.length || (email ? allowed.includes(email) : false);
    if (!isStaff && !emailAllowed) {
      if (!isLoginRoute) {
        const url = req.nextUrl.clone();
        url.pathname = "/hq/login";
        url.search = "";
        url.searchParams.set("redirectTo", targetPath);
        url.searchParams.set("reason", "forbidden");
        return NextResponse.redirect(url);
      }
    }
  }
  if (req.nextUrl.pathname.startsWith("/api/investors")) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const allowed = await isInvestorAllowed(session.user.id, session.user.email);
    if (!allowed) {
      return new NextResponse(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
  }

  return res;
}

export const config = {
  // Apply middleware on portal, select-org and hq routes
  matcher: ["/c/:path*", "/select-org", "/hq/:path*", "/inversionistas/:path*", "/api/c/:path*", "/api/investors/:path*"],
};

