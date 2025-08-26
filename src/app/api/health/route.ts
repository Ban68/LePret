// src/app/api/health/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { count, error } = await supabaseAdmin
      .from("contacts")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, table: "contacts", count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
