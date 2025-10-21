import { createSignatureEnvelope } from "@/lib/integrations/pandadoc";
import { notifyClientContractReady, getCompanyActiveMemberEmails } from "@/lib/notifications";
import { logAudit, logIntegrationWarning } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase";

export class ContractGenerationError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = "ContractGenerationError";
    this.code = code;
    this.status = status;
  }
}

type DocumentRow = {
  id: string;
  company_id: string;
  request_id: string | null;
  type: string;
  status: string;
  provider: string | null;
  provider_envelope_id: string | null;
  created_at: string;
};

type GenerateContractOptions = {
  orgId: string;
  requestId: string;
  actorId?: string | null;
  fallbackEmail?: string | null;
  skipIfExists?: boolean;
};

type ContractGenerationResult = {
  document: DocumentRow | null;
  envelope: {
    provider: string;
    envelopeId: string;
    status?: string;
    signUrl?: string | null;
  } | null;
  skipped?: boolean;
  skipReason?: string;
};

export async function generateContractForRequest(
  options: GenerateContractOptions,
): Promise<ContractGenerationResult> {
  const { orgId, requestId, actorId = null, fallbackEmail = null, skipIfExists = false } = options;
  const supabaseAdmin = getSupabaseAdminClient();

  const { data: requestRow, error: requestError } = await supabaseAdmin
    .from("funding_requests")
    .select("id, company_id, status, requested_amount")
    .eq("id", requestId)
    .eq("company_id", orgId)
    .single();

  if (requestError || !requestRow) {
    throw new ContractGenerationError("not_found", requestError?.message || "Request not found", 404);
  }

  const normalizedStatus = String(requestRow.status || "").toLowerCase();
  if (normalizedStatus !== "accepted" && normalizedStatus !== "offered") {
    throw new ContractGenerationError("invalid_status", "Request not ready for contract generation", 400);
  }

  if (skipIfExists) {
    const { data: existingDoc } = await supabaseAdmin
      .from("documents")
      .select("id, company_id, request_id, type, status, provider, provider_envelope_id, created_at")
      .eq("request_id", requestId)
      .eq("type", "CONTRATO_MARCO")
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (existingDoc) {
      try {
        const appBase = process.env.PANDADOC_APP_URL || "https://app.pandadoc.com/a/#/documents/";
        const appUrl = existingDoc.provider_envelope_id ? `${appBase}${existingDoc.provider_envelope_id}` : null;
        await notifyClientContractReady(orgId, requestId, { signUrl: null, appUrl });
      } catch {}
      return { document: existingDoc as DocumentRow, envelope: null, skipped: true, skipReason: "existing_document" };
    }
  }

  const templateId = process.env.PANDADOC_TEMPLATE_CONTRATO_MARCO;
  if (!templateId) {
    await logIntegrationWarning({
      company_id: orgId,
      actor_id: actorId ?? null,
      provider: "pandadoc",
      message: "missing_template_env",
      meta: { request_id: requestId },
    });
    throw new ContractGenerationError("missing_template_env", "Missing PandaDoc template configuration");
  }

  const signRole = process.env.PANDADOC_SIGN_ROLE || "signer";
  const sendViaPandaDoc = (process.env.PANDADOC_SEND || "").toLowerCase() === "true";

  const { admins, clients } = await getCompanyActiveMemberEmails(orgId);
  const recipientEmail = clients[0] || admins[0] || fallbackEmail || "";

  if (!recipientEmail) {
    await logIntegrationWarning({
      company_id: orgId,
      actor_id: actorId ?? null,
      provider: "pandadoc",
      message: "missing_recipient_email",
      meta: { request_id: requestId },
    });
    throw new ContractGenerationError("missing_recipient_email", "No email found for contract recipient");
  }

  let envelope;
  try {
    envelope = await createSignatureEnvelope({
      name: `Contrato Marco - ${orgId}`,
      recipients: [{ email: recipientEmail, role: signRole }],
      variables: {
        company_id: orgId,
        request_id: requestId,
        amount: Number(requestRow.requested_amount || 0),
      },
      templateId,
      send: sendViaPandaDoc,
      subject: `[LePret] Contrato listo para firma`,
      message: `Se ha generado un contrato para la solicitud ${requestId}. Por favor, revísalo y fírmalo.`,
    });
  } catch (error) {
    await logIntegrationWarning({
      company_id: orgId,
      actor_id: actorId ?? null,
      provider: "pandadoc",
      message: error instanceof Error ? error.message : String(error),
      meta: { request_id: requestId },
    });
    throw error;
  }

  const { data: documentRow, error: insertError } = await supabaseAdmin
    .from("documents")
    .insert({
      company_id: orgId,
      request_id: requestId,
      type: "CONTRATO_MARCO",
      status: envelope.status || "created",
      provider: "PANDADOC",
      provider_envelope_id: envelope.envelopeId,
      uploaded_by: actorId,
    })
    .select()
    .single();

  if (insertError || !documentRow) {
    const errorMessage =
      insertError && typeof insertError === "object" && "message" in insertError && typeof insertError.message === "string"
        ? insertError.message
        : "Failed to persist contract document";
    const details =
      insertError && typeof insertError === "object" && "details" in insertError && typeof insertError.details === "string"
        ? insertError.details
        : null;
    const supabaseCode =
      insertError && typeof insertError === "object" && "code" in insertError && typeof insertError.code === "string"
        ? insertError.code
        : null;
    let code = supabaseCode ? `supabase_${supabaseCode}` : "contract_persist_failed";
    let message = details ? `${errorMessage} (${details})` : errorMessage;

    if (supabaseCode === "23505") {
      code = "contract_already_exists";
      message = "Ya existe un contrato generado para esta solicitud.";
    }

    await logIntegrationWarning({
      company_id: orgId,
      actor_id: actorId ?? null,
      provider: "pandadoc",
      message,
      meta: { request_id: requestId, code },
    });
    throw new ContractGenerationError(code, message);
  }

  try {
    const appBase = process.env.PANDADOC_APP_URL || "https://app.pandadoc.com/a/#/documents/";
    const appUrl = `${appBase}${documentRow.provider_envelope_id ?? ""}`;
    await notifyClientContractReady(orgId, requestId, {
      signUrl: envelope.signUrl || null,
      appUrl,
    });
  } catch {}

  await logAudit({
    company_id: orgId,
    actor_id: actorId ?? null,
    entity: "document",
    entity_id: documentRow.id,
    action: "created",
    data: { type: "CONTRATO_MARCO" },
  });

  return { document: documentRow as DocumentRow, envelope };
}
