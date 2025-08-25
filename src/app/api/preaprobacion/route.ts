// src/app/api/preaprobacion/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const company_name       = body.company_name ?? body.empresa ?? body.razon_social;
    const nit                = body.nit;
    const contact_name       = body.contact_name ?? body.nombre ?? null;
    const email              = body.email ?? null;
    const phone              = body.phone ?? body.telefono ?? null;
    const monthly_sales      = body.monthly_sales ?? body.ventas_mensuales ?? null;
    const invoices_per_month = body.invoices_per_month ?? body.facturas_mes ?? null;
    const avg_ticket         = body.avg_ticket ?? body.ticket_promedio ?? null;
    const factoring_type     = body.factoring_type ?? body.tipo_factoring ?? null;
    const accepted_privacy   = body.accepted_privacy ?? body.consent ?? false;

    if (!company_name || !nit || !accepted_privacy) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios." },
        { status: 400 }
      );
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent") ?? null;

    const qs = new URL(req.url).searchParams;
    const utm_source   = body.utm_source   ?? qs.get("utm_source");
    const utm_medium   = body.utm_medium   ?? qs.get("utm_medium");
    const utm_campaign = body.utm_campaign ?? qs.get("utm_campaign");
    const utm_term     = body.utm_term     ?? qs.get("utm_term");
    const utm_content  = body.utm_content  ?? qs.get("utm_content");
    const referrer     = body.referrer     ?? req.headers.get("referer");

    const { error } = await supabaseAdmin.from("preapprovals").insert({
      company_name,
      nit,
      contact_name,
      email,
      phone,
      monthly_sales,
      invoices_per_month,
      avg_ticket,
      factoring_type,
      accepted_privacy,
      status: "new",
      ip,
      user_agent: ua,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      referrer,
    });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
