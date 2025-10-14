import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

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
      // Staff bypass
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_staff")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (prof?.is_staff) {
        res.cookies.set("last_org", `client:${orgId}`, { path: "/", maxAge: 60 * 60 * 24 * 90 });
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

      res.cookies.set("last_org", `client:${orgId}`, { path: "/", maxAge: 60 * 60 * 24 * 90 });
    }
  }

  // Investor portal access: require session and active membership (unless staff)
  if (req.nextUrl.pathname.startsWith("/i/")) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    const match = req.nextUrl.pathname.match(/^\/i\/([^\/]+)/);
    const orgId = match?.[1];
    if (orgId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_staff")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (prof?.is_staff) {
        res.cookies.set("last_org", `investor:${orgId}`, { path: "/", maxAge: 60 * 60 * 24 * 90 });
        return res;
      }

      const { data, error } = await supabase
        .from("memberships")
        .select("company_id")
        .eq("company_id", orgId)
        .eq("user_id", session.user.id)
        .eq("status", "ACTIVE")
        .limit(1);
      if (error || !data || data.length === 0) {
        const url = req.nextUrl.clone();
        url.pathname = "/select-org";
        url.searchParams.set("reason", "no-membership");
        return NextResponse.redirect(url);
      }

      res.cookies.set("last_org", `investor:${orgId}`, { path: "/", maxAge: 60 * 60 * 24 * 90 });
    }
  }

  // If session exists and goes to /select-org, redirect to last org
  if (req.nextUrl.pathname === "/select-org") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const lastOrgRaw = req.cookies.get("last_org")?.value;
    if (session && lastOrgRaw) {
      let targetType: "client" | "investor" = "client";
      let targetId = lastOrgRaw;
      if (lastOrgRaw.includes(":")) {
        const [type, ...rest] = lastOrgRaw.split(":");
        const joined = rest.join(":");
        if (type === "investor" && joined) {
          targetType = "investor";
          targetId = joined;
        } else if (type === "client" && joined) {
          targetType = "client";
          targetId = joined;
        } else {
          targetId = joined || lastOrgRaw;
        }
      }
      const url = req.nextUrl.clone();
      url.pathname = targetType === "investor" ? `/i/${targetId}` : `/c/${targetId}`;
      return NextResponse.redirect(url);
    }
  }

  // Backoffice: restrict /hq to staff or allowlisted emails
  if (req.nextUrl.pathname.startsWith("/hq")) {
    const isLegacyLoginRoute = req.nextUrl.pathname.startsWith("/hq/login");
    const targetPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      if (!isLegacyLoginRoute) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
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
      if (!isLegacyLoginRoute) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        url.search = "";
        url.searchParams.set("redirectTo", targetPath);
        url.searchParams.set("reason", "forbidden");
        return NextResponse.redirect(url);
      }
    }
  }
  return res;
}

export const config = {
  // Apply middleware on portal, select-org and hq routes
  matcher: ["/c/:path*", "/i/:path*", "/select-org", "/hq/:path*", "/api/c/:path*"],
};

