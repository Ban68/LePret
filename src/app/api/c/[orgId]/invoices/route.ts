import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  context: { params: { orgId: string } }
) {
  const { orgId } = context.params;
  // Placeholder: devolver muestra estática
  return NextResponse.json({
    ok: true,
    orgId,
    items: [
      {
        id: "inv-demo-1",
        amount: 10000000,
        issueDate: "2025-01-01",
        dueDate: "2025-02-01",
        status: "uploaded",
      },
    ],
  });
}

export async function POST(
  req: Request,
  context: { params: { orgId: string } }
) {
  const { orgId } = context.params;
  const body = await req.json().catch(() => ({}));
  // Placeholder: aceptar cualquier payload y responder 201
  return NextResponse.json(
    {
      ok: true,
      orgId,
      created: { id: "inv-demo-created", ...body },
    },
    { status: 201 }
  );
}

