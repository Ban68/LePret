import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { logFeedbackEvent } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    const { orgId, requestId, kind, score, comment } = body as {
      orgId?: string;
      requestId?: string;
      kind?: string;
      score?: number;
      comment?: string;
    };

    if (typeof orgId !== "string" || !orgId) {
      return NextResponse.json({ ok: false, error: "missing_org" }, { status: 400 });
    }

    const normalizedKind = typeof kind === "string" ? kind.toUpperCase() : null;
    if (normalizedKind !== "NPS" && normalizedKind !== "CSAT") {
      return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
    }

    if (!Number.isFinite(score) || score == null) {
      return NextResponse.json({ ok: false, error: "invalid_score" }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('status')
      .eq('company_id', orgId)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!membership || membership.status !== 'ACTIVE') {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    await logFeedbackEvent({
      company_id: orgId,
      actor_id: session.user.id,
      entity_id: typeof requestId === "string" ? requestId : undefined,
      kind: normalizedKind,
      score: Number(score),
      comment: typeof comment === "string" && comment.trim().length ? comment.trim() : null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
