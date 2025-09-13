import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCompanyActiveMemberEmails } from "@/lib/notifications";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  try {
    const { orgId, requestId } = await params;
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Validar que la solicitud exista y esté aceptada
    const { data: reqRow, error: rErr } = await supabase
      .from("funding_requests")
      .select("id, company_id, status, requested_amount")
      .eq("id", requestId)
      .eq("company_id", orgId)
      .single();
    if (rErr || !reqRow) throw new Error(rErr?.message || "Request not found");
    if (reqRow.status !== 'accepted' && reqRow.status !== 'offered') {
      return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
    }

    // Crear sobre de firma (placeholder PandaDoc)
    const { createSignatureEnvelope } = await import("@/lib/integrations/pandadoc");
    const templateId = process.env.PANDADOC_TEMPLATE_CONTRATO_MARCO;
    if (!templateId) return NextResponse.json({ ok: false, error: 'missing_template_env' }, { status: 500 });
    const signRole = process.env.PANDADOC_SIGN_ROLE || 'signer';

    // Elegir destinatario principal: clientes activos o admins si no hay
    const { admins, clients } = await getCompanyActiveMemberEmails(orgId);
    const recipientEmail = (clients[0] || admins[0] || session.user.email) as string;
    const sendViaPandaDoc = (process.env.PANDADOC_SEND || '').toLowerCase() === 'true';
    const envelope = await createSignatureEnvelope({
      name: `Contrato Marco - ${orgId}`,
      recipients: [{ email: recipientEmail || "", role: signRole }],
      variables: { company_id: orgId, request_id: requestId, amount: Number(reqRow.requested_amount || 0) },
      templateId,
      send: sendViaPandaDoc,
      subject: `[LePret] Contrato listo para firma` ,
      message: `Se ha generado un contrato para la solicitud ${requestId}. Por favor, revísalo y fírmalo.`,
    });

    // Guardar documento en tabla documents
    const { data: doc, error: dErr } = await supabase
      .from("documents")
      .insert({
        company_id: orgId,
        request_id: requestId,
        type: 'CONTRATO_MARCO',
        status: 'created',
        provider: 'PANDADOC',
        provider_envelope_id: (envelope as any).envelopeId,
        uploaded_by: session.user.id,
      })
      .select()
      .single();
    if (dErr) throw dErr;

    // Notificar al cliente que el contrato está listo
    try {
      const { notifyClientContractReady } = await import("@/lib/notifications");
      const appBase = process.env.PANDADOC_APP_URL || 'https://app.pandadoc.com/a/#/documents/';
      const appUrl = `${appBase}${(doc as any).provider_envelope_id}`;
      await notifyClientContractReady(orgId, { signUrl: (envelope as any).signUrl || null, appUrl });
    } catch {}

    // Auditoría
    try {
      const { logAudit } = await import("@/lib/audit");
      await logAudit({ company_id: orgId, actor_id: session.user.id, entity: 'document', entity_id: doc.id, action: 'created', data: { type: 'CONTRATO_MARCO' } });
    } catch {}

    return NextResponse.json({ ok: true, envelope, document: doc });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
