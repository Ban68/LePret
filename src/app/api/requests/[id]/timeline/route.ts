import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase-server";
import { computeClientNextSteps, createRequestMessage, getRequestTimeline } from "@/lib/request-timeline";
import { notifyStaffRequestMessage } from "@/lib/notifications";

export const dynamic = "force-dynamic";

async function ensureRequestAccess(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  requestId: string,
  userId: string,
) {
  const { data: request, error } = await supabase
    .from("funding_requests")
    .select("id, company_id, status, requested_amount, created_at")
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!request) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id")
    .eq("company_id", request.company_id)
    .eq("user_id", userId)
    .limit(1);

  if (membershipError) throw new Error(membershipError.message);
  if (!membership || membership.length === 0) return null;

  return request as { id: string; company_id: string; status: string; requested_amount: number; created_at: string };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await supabaseServer();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const request = await ensureRequestAccess(supabase, id, session.user.id);
    if (!request) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const timeline = await getRequestTimeline(supabase, id);

    const { data: collectionCase } = await supabase
      .from("collection_cases")
      .select("id, status, next_action_at, promise_amount, promise_date, closed_at")
      .eq("request_id", id)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSteps = computeClientNextSteps(request.status, collectionCase);

    return NextResponse.json({
      ok: true,
      request,
      timeline,
      collectionCase,
      nextSteps,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/requests/[id]/timeline", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await supabaseServer();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const request = await ensureRequestAccess(supabase, id, session.user.id);
    if (!request) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const payload = await req.json();
    const message = typeof payload?.message === "string" ? payload.message.trim() : "";
    if (!message) {
      return NextResponse.json({ ok: false, error: "Mensaje requerido" }, { status: 400 });
    }

    const subject = typeof payload?.subject === "string" && payload.subject.trim() ? payload.subject.trim() : null;
    const visibility = payload?.visibility === "internal" ? "internal" : "client";

    const senderName =
      (typeof session.user.user_metadata === "object" && session.user.user_metadata && "full_name" in session.user.user_metadata)
        ? String(session.user.user_metadata.full_name)
        : session.user.email ?? null;

    await createRequestMessage(supabase, {
      requestId: id,
      companyId: request.company_id,
      body: message,
      subject,
      visibility,
      messageType: payload?.messageType ?? null,
      senderId: session.user.id,
      senderRole: "client",
      senderName,
    });

    if (visibility === "client") {
      await notifyStaffRequestMessage(request.company_id, id, message);
    }

    const timeline = await getRequestTimeline(supabase, id);
    const { data: collectionCase } = await supabase
      .from("collection_cases")
      .select("id, status, next_action_at, promise_amount, promise_date, closed_at")
      .eq("request_id", id)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSteps = computeClientNextSteps(request.status, collectionCase);

    return NextResponse.json({
      ok: true,
      timeline,
      collectionCase,
      nextSteps,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/requests/[id]/timeline", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

