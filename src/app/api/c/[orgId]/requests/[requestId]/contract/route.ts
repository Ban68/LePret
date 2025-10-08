import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { isStaffUser } from "@/lib/staff";
import { logIntegrationWarning } from "@/lib/audit";
import { generateContractForRequest, ContractGenerationError } from "@/lib/contracts";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  const { orgId, requestId } = await params;

  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const allowed = await isStaffUser(supabase, session.user.id);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    try {
      const result = await generateContractForRequest({
        orgId,
        requestId,
        actorId: session.user.id,
        fallbackEmail: session.user.email,
      });

      return NextResponse.json({ ok: true, envelope: result.envelope, document: result.document });
    } catch (error) {
      if (error instanceof ContractGenerationError) {
        return NextResponse.json({ ok: false, error: error.code }, { status: error.status });
      }
      throw error;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await logIntegrationWarning({
      company_id: orgId,
      provider: "pandadoc",
      message: msg,
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
