import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(
  _req: Request,
  context: { params: { orgId: string } }
) {
  const session = await auth();
  const { orgId } = context.params;

  // Placeholder: devolver información mínima de sesión/membresía
  return NextResponse.json({
    ok: true,
    orgId,
    session: session ?? null,
    membership: session
      ? { orgId, user: session.user, role: (session as any).role ?? "client" }
      : null,
  });
}

