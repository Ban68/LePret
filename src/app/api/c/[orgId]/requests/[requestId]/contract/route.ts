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
        skipIfExists: true,
      });

      return NextResponse.json({
        ok: true,
        envelope: result.envelope,
        document: result.document,
        skipped: Boolean(result.skipped),
        skipReason: result.skipReason ?? null,
      });
    } catch (error) {
      if (error instanceof ContractGenerationError) {
        return NextResponse.json(
          { ok: false, error: error.message, code: error.code },
          { status: error.status },
        );
      }
      throw error;
    }
  } catch (e: unknown) {
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : (() => {
              try {
                return JSON.stringify(e);
              } catch {
                return String(e);
              }
            })();
    const code =
      e instanceof Error && "code" in e && typeof (e as { code?: unknown }).code === "string"
        ? (e as { code: string }).code
        : "contract_generation_unexpected_error";
    await logIntegrationWarning({
      company_id: orgId,
      provider: "pandadoc",
      message: msg,
    });
    return NextResponse.json({ ok: false, error: msg, code }, { status: 500 });
  }
}
