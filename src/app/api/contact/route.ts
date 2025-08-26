// src/app/api/contact/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Acepta nombres de campos en español/inglés
    const nombre   = body.name ?? body.nombre;
    const email    = body.email ?? body.correo;
    const telefono = body.phone ?? body.telefono ?? null;
    const empresa  = body.company ?? body.empresa ?? null;
    const nit      = body.nit ?? null;
    const pais     = body.country ?? body.pais ?? null;
    const mensaje  = body.message ?? body.mensaje ?? null;
    const consent  = body.consent ?? body.accepted_privacy ?? false;

    if (!nombre || !email || !mensaje) {
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

    const { error } = await supabaseAdmin.from("contacts").insert({
      full_name: nombre,
      email,
      phone: telefono,
      company: empresa,
      nit,
      country: pais,
      message: mensaje,
      consent,
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

    // (Opcional) mantener aquí el envío de email con Resend si ya existe

    return NextResponse.json({ ok: true, message: "Mensaje recibido" });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}