import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const ENABLED = (process.env.ENABLE_MOCK_INVOICES || process.env.NEXT_PUBLIC_ENABLE_MOCK_INVOICES || '').toLowerCase() === 'true';

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomAmount(): number {
  const min = 3_000_000;
  const max = 40_000_000;
  const step = 500_000;
  const range = Math.floor((max - min) / step);
  return min + Math.floor(Math.random() * (range + 1)) * step;
}

function randomDateOffset(base: Date, offsetDays: number): string {
  const clone = new Date(base);
  clone.setDate(clone.getDate() + offsetDays);
  return clone.toISOString().slice(0, 10);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    if (!ENABLED) {
      return NextResponse.json({ ok: false, error: 'mock_invoices_disabled' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { orgId } = await params;
    const count = Math.max(1, Math.min(10, Number(body?.count ?? 3)));

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    const payers = [
      'Mock Payer S.A.S.',
      'Comercializadora Demo LTDA',
      'Servicios Prueba S.A.',
      'Ficticia & Cia',
    ];

    const rows = Array.from({ length: count }, () => {
      const issueBase = new Date(today);
      issueBase.setDate(issueBase.getDate() - Math.floor(Math.random() * 45));
      const dueDate = randomDateOffset(issueBase, 30 + Math.floor(Math.random() * 45));
      const forecast = randomDateOffset(issueBase, 60 + Math.floor(Math.random() * 30));

      return {
        company_id: orgId,
        created_by: session.user.id,
        amount: randomAmount(),
        issue_date: issueBase.toISOString().slice(0, 10),
        due_date: dueDate,
        status: 'uploaded',
        payer: pick(payers),
        forecast_payment_date: forecast,
        file_path: null,
      } as Record<string, unknown>;
    });

    const { data, error } = await supabase
      .from('invoices')
      .insert(rows)
      .select('id');

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, created: data ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
