import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  context: { params: { orgId: string } }
) {
  const { orgId } = context.params;
  return NextResponse.json({
    ok: true,
    orgId,
    items: [
      { id: "req-demo-1", invoiceId: "inv-demo-1", amountRequested: 8000000, status: "review" },
    ],
  });
}

export async function POST(
  req: Request,
  context: { params: { orgId: string } }
) {
  const { orgId } = context.params;
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(
    { ok: true, orgId, created: { id: "req-demo-created", ...body } },
    { status: 201 }
  );
}

