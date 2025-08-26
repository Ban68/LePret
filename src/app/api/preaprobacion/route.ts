// src/app/api/preaprobacion/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Simple business logic for credit line estimation
function calculateCupo(
  ventasAnuales: number,
  ticketPromedio: number,
  facturasMes: number
): number {
  const cupoPorVentas = ventasAnuales * 0.1; // 10% of annual sales
  const cupoPorTicket = ticketPromedio * 10; // 10x average ticket
  const factorFacturas = Math.min(facturasMes / 20, 1.5); // Multiplier based on invoice volume, capped at 1.5

  const cupoBase = Math.min(cupoPorVentas, cupoPorTicket);
  const cupoEstimado = cupoBase * factorFacturas;

  // Round to nearest 1,000,000
  return Math.round(cupoEstimado / 1000000) * 1000000;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const company_name =
      body.company_name ?? body.empresa ?? body.razon_social ?? body.razonSocial;
    const nit = body.nit;
    const email = body.email ?? null;
    const phone = body.phone ?? body.telefono ?? null;
    const ventasAnuales = body.ventasAnuales ?? body.ventas_anuales ?? null;
    const facturasMes = body.facturasMes ?? body.facturas_mes ?? null;
    const ticketPromedio = body.ticketPromedio ?? body.ticket_promedio ?? null;
    const accepted_privacy = body.accepted_privacy ?? body.consent ?? false;

    if (!company_name || !nit || !accepted_privacy) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios." },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent") ?? null;

    const qs = new URL(req.url).searchParams;
    const utm_source = body.utm_source ?? qs.get("utm_source");
    const utm_medium = body.utm_medium ?? qs.get("utm_medium");
    const utm_campaign = body.utm_campaign ?? qs.get("utm_campaign");
    const utm_term = body.utm_term ?? qs.get("utm_term");
    const utm_content = body.utm_content ?? qs.get("utm_content");
    const referrer = body.referrer ?? req.headers.get("referer");

    const cupoEstimado = calculateCupo(
      Number(ventasAnuales ?? 0),
      Number(ticketPromedio ?? 0),
      Number(facturasMes ?? 0)
    );

    const { error } = await supabaseAdmin.from("preapprovals").insert({
      company_name,
      nit,
      email,
      phone,
      monthly_sales: ventasAnuales ? ventasAnuales / 12 : null,
      invoices_per_month: facturasMes,
      avg_ticket: ticketPromedio,
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

    return NextResponse.json({
      cupoEstimado,
      message: "¡Preaprobación exitosa!",
      nextSteps:
        "Un asesor se pondrá en contacto contigo para los siguientes pasos.",
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
