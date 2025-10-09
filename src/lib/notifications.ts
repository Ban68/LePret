import { Resend } from "resend";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { canManageMembership, normalizeMemberRole } from "@/lib/rbac";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || "no-reply@example.com";

function staffRecipients(): string[] {
  const list = (process.env.BACKOFFICE_NOTIFICATIONS || process.env.BACKOFFICE_ALLOWED_EMAILS || "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(list));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

async function getUserIdsForEmails(emails: string[]): Promise<string[]> {
  if (!emails.length) return [];
  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("auth.users" as unknown as string)
    .select("id, email")
    .in("email", emails);
  if (error || !data) return [];
  const ids = (data as Array<{ id: string | null }>).map((row) => row.id).filter((id): id is string => Boolean(id));
  return unique(ids);
}

export async function getCompanyActiveMemberEmails(companyId: string): Promise<{
  owners: string[];
  admins: string[];
  clients: string[];
  all: string[];
  ownerIds: string[];
  adminIds: string[];
  clientIds: string[];
  allIds: string[];
}> {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data: members, error } = await supabaseAdmin
    .from("memberships")
    .select("user_id, role, status")
    .eq("company_id", companyId)
    .eq("status", "ACTIVE");
  if (error)
    return {
      owners: [],
      admins: [],
      clients: [],
      all: [],
      ownerIds: [],
      adminIds: [],
      clientIds: [],
      allIds: [],
    };
  const userIds = (members || []).map((m) => (m as { user_id: string }).user_id);
  if (!userIds.length)
    return {
      owners: [],
      admins: [],
      clients: [],
      all: [],
      ownerIds: [],
      adminIds: [],
      clientIds: [],
      allIds: [],
    };
  const { data: users } = await supabaseAdmin.from("auth.users" as unknown as string).select("id, email").in("id", userIds);
  const emailById: Record<string, string> = {};
  (users as Array<{ id: string; email: string | null }> | null || []).forEach((u) => { if (u.email) emailById[u.id] = u.email; });
  const ownerEmails: string[] = [];
  const adminEmails: string[] = [];
  const clientEmails: string[] = [];
  const ownerIds: string[] = [];
  const adminIds: string[] = [];
  const clientIds: string[] = [];
  (members || []).forEach((m) => {
    const row = m as { user_id: string; role: string };
    const email = emailById[row.user_id];
    if (!email) return;
    const canonicalRole = normalizeMemberRole(row.role);
    if (!canonicalRole) return;
    if (canManageMembership(canonicalRole)) {
      adminEmails.push(email);
      adminIds.push(row.user_id);
    } else {
      clientEmails.push(email);
      clientIds.push(row.user_id);
    }
    if (canonicalRole === "OWNER") {
      ownerEmails.push(email);
      ownerIds.push(row.user_id);
    }
  });
  const owners = unique(ownerEmails);
  const admins = unique(adminEmails);
  const clients = unique(clientEmails);
  const all = unique([...owners, ...admins, ...clients]);
  const uniqueOwnerIds = unique(ownerIds);
  const uniqueAdminIds = unique(adminIds);
  const uniqueClientIds = unique(clientIds);
  const allIds = unique([...uniqueOwnerIds, ...uniqueAdminIds, ...uniqueClientIds]);
  return {
    owners,
    admins,
    clients,
    all,
    ownerIds: uniqueOwnerIds,
    adminIds: uniqueAdminIds,
    clientIds: uniqueClientIds,
    allIds,
  };
}

export async function createNotification(
  userIds: string[],
  type: string,
  message: string,
  data?: Record<string, unknown> | null,
) {
  const recipientIds = unique(userIds);
  if (!recipientIds.length) return;
  const supabaseAdmin = getSupabaseAdminClient();
  const rows = recipientIds.map((userId) => ({
    user_id: userId,
    type,
    message,
    data: data ?? null,
  }));
  const { error } = await supabaseAdmin.from("notifications").insert(rows);
  if (error) {
    console.error("Failed to create notification", error);
  }
}

async function sendEmail(to: string[] | string, subject: string, html: string) {
  if (!resend) return { ok: false, skipped: true, reason: "missing_resend_key" } as const;
  if (!to || (Array.isArray(to) && to.length === 0)) return { ok: false, skipped: true, reason: "no_recipients" } as const;
  const recipients = Array.isArray(to) ? to : [to];
  await resend.emails.send({ from: EMAIL_FROM, to: recipients, subject, html });
  return { ok: true } as const;
}

export async function notifyStaffNewRequest(companyId: string, requestId: string) {
  const staff = staffRecipients();
  if (!staff.length) return;
  const staffIds = await getUserIdsForEmails(staff);
  const subject = `Nueva solicitud creada (${companyId})`;
  const html = `<p>Se creó una nueva solicitud</p><p>Empresa: <code>${companyId}</code></p><p>Solicitud: <code>${requestId}</code></p>`;
  await sendEmail(staff, subject, html);
  await createNotification(staffIds, "staff_new_request", `Nueva solicitud creada (${companyId})`, {
    companyId,
    requestId,
  });
}

export async function notifyCompanyRequestCreated(
  companyId: string,
  requestId: string,
  actorId?: string | null,
) {
  const { adminIds, clientIds } = await getCompanyActiveMemberEmails(companyId);
  const recipients = unique([
    ...adminIds,
    ...clientIds,
  ]);
  const filtered = actorId ? recipients.filter((id) => id !== actorId) : recipients;
  if (!filtered.length) return;
  await createNotification(filtered, "request_created", "Se creó una nueva solicitud en tu empresa.", {
    companyId,
    requestId,
  });
}

export async function notifyClientOfferGenerated(companyId: string, offerId: string) {
  const { admins, clients, adminIds, clientIds } = await getCompanyActiveMemberEmails(companyId);
  const recipients = clients.length ? clients : admins; // fallback a admins si no hay clientes
  const recipientIds = clients.length ? clientIds : adminIds;
  if (!recipients.length) return;
  const subject = `Tu oferta está lista (#${offerId.slice(0, 8)})`;
  const html = `<p>Hemos generado una oferta para tu solicitud.</p><p>Identificador de oferta: <code>${offerId}</code></p>`;
  await sendEmail(recipients, subject, html);
  await createNotification(
    recipientIds,
    "client_offer_generated",
    "Hemos generado una oferta para tu solicitud.",
    {
      companyId,
      offerId,
    },
  );
}

export async function notifyStaffOfferGenerated(companyId: string, requestId: string, offerId: string) {
  const staff = staffRecipients();
  if (!staff.length) return;
  const staffIds = await getUserIdsForEmails(staff);
  if (!staffIds.length) return;
  const subject = `Nueva oferta generada (${companyId})`;
  const html = `
    <p>Se generó una nueva oferta para la solicitud <code>${requestId}</code>.</p>
    <p><strong>Empresa:</strong> <code>${companyId}</code></p>
    <p><strong>Oferta:</strong> <code>${offerId}</code></p>
  `;
  await sendEmail(staff, subject, html);
  await createNotification(staffIds, "staff_offer_generated", `Nueva oferta generada (${companyId})`, {
    companyId,
    requestId,
    offerId,
  });
}

export async function notifyStaffOfferAccepted(companyId: string, offerId: string) {
  const staff = staffRecipients();
  if (!staff.length) return;
  const staffIds = await getUserIdsForEmails(staff);
  const subject = `Oferta aceptada (${companyId})`;
  const html = `<p>El cliente aceptó una oferta.</p><p>Empresa: <code>${companyId}</code></p><p>Oferta: <code>${offerId}</code></p>`;
  await sendEmail(staff, subject, html);
  await createNotification(staffIds, "staff_offer_accepted", `Oferta aceptada (${companyId})`, {
    companyId,
    offerId,
  });
}

// Flexible helper: accepts either a signUrl (string) or an options object
// { signUrl?: string, appUrl?: string }
export async function notifyClientContractReady(
  companyId: string,
  requestId: string,
  options: string | { signUrl?: string | null; appUrl?: string | null }
) {
  const { admins, clients, adminIds, clientIds } = await getCompanyActiveMemberEmails(companyId);
  const recipients = clients.length ? clients : admins;
  const recipientIds = clients.length ? clientIds : adminIds;
  if (!recipients.length) return;

  let signUrl: string | null = null;
  let appUrl: string | null = null;
  if (typeof options === 'string') {
    signUrl = options;
  } else {
    signUrl = options.signUrl ?? null;
    appUrl = options.appUrl ?? null;
  }

  const subject = `Contrato listo para firma`;
  let html = `<p>Hemos preparado tu contrato.</p>`;
  if (signUrl) {
    html += `<p><a href="${signUrl}">Firmar contrato</a></p>`;
  } else if (appUrl) {
    html += `<p>Para continuar, abre el documento en PandaDoc y pulsa “Enviar”.</p>`;
    html += `<p><a href="${appUrl}">Abrir en PandaDoc</a></p>`;
  } else {
    html += `<p>Te contactaremos con el enlace de firma en breve.</p>`;
  }
  await sendEmail(recipients, subject, html);
  await createNotification(recipientIds, "contract_ready", "Tu contrato está listo para firma.", {
    companyId,
    requestId,
    signUrl,
    appUrl,
  });
}

export async function notifyStaffContractReady(
  companyId: string,
  requestId: string,
  options?: { documentId?: string | null; appUrl?: string | null }
) {
  const staff = staffRecipients();
  if (!staff.length) return;
  const staffIds = await getUserIdsForEmails(staff);
  if (!staffIds.length) return;
  const subject = `Contrato listo para firma (${companyId})`;
  const html = `
    <p>El contrato para la solicitud <code>${requestId}</code> está listo para firma.</p>
    ${options?.appUrl ? `<p><a href="${options.appUrl}">Ver en PandaDoc</a></p>` : ""}
  `;
  await sendEmail(staff, subject, html);
  await createNotification(staffIds, "contract_ready", `Contrato listo para firma (${companyId})`, {
    companyId,
    requestId,
    documentId: options?.documentId ?? null,
    appUrl: options?.appUrl ?? null,
  });
}

export async function notifyClientFunded(companyId: string, requestId: string) {
  const { admins, clients, adminIds, clientIds } = await getCompanyActiveMemberEmails(companyId);
  const recipients = clients.length ? clients : admins;
  const recipientIds = clients.length ? clientIds : adminIds;
  if (!recipients.length) return;
  const subject = `Desembolso realizado`;
  const html = `<p>Tu operación ha sido desembolsada.</p><p>Solicitud: <code>${requestId}</code></p>`;
  await sendEmail(recipients, subject, html);
  await createNotification(recipientIds, "request_funded", "Tu operación ha sido desembolsada.", {
    companyId,
    requestId,
  });
}

export async function notifyStaffDisbursementRequested(
  companyId: string,
  requestId: string,
  paymentId?: string | null
) {
  const staff = staffRecipients();
  if (!staff.length) return;
  const staffIds = await getUserIdsForEmails(staff);
  const subject = `Solicitud de desembolso (${companyId})`;
  const html = `
    <p>El cliente pidió el desembolso de la solicitud <code>${requestId}</code>.</p>
    ${paymentId ? `<p>Registro de pago: <code>${paymentId}</code></p>` : ""}
    <p>Revisa el portal de back-office para procesar la transferencia.</p>
  `;
  await sendEmail(staff, subject, html);
  await createNotification(staffIds, "disbursement_requested", `Solicitud de desembolso (${companyId})`, {
    companyId,
    requestId,
    paymentId: paymentId ?? null,
  });
}

export async function notifyClientNeedsDocs(companyId: string, note?: string) {
  const { admins, clients, adminIds, clientIds } = await getCompanyActiveMemberEmails(companyId);
  const recipients = clients.length ? clients : admins;
  const recipientIds = clients.length ? clientIds : adminIds;
  if (!recipients.length) return;
  const subject = `Documentación requerida`;
  const html = `<p>Necesitamos documentos adicionales para continuar.</p>${note ? `<p>${note}</p>` : ''}`;
  await sendEmail(recipients, subject, html);
  await createNotification(
    recipientIds,
    "client_needs_docs",
    "Necesitamos documentos adicionales para continuar.",
    {
      companyId,
      note: note ?? null,
    },
  );
}


function formatPreview(message: string, maxLength = 180) {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

export async function notifyStaffRequestMessage(companyId: string, requestId: string, body: string) {
  const staff = staffRecipients();
  if (!staff.length) return;
  const staffIds = await getUserIdsForEmails(staff);
  const preview = formatPreview(body);
  const subject = `Nuevo mensaje en solicitud ${requestId.slice(0, 8)}`;
  const html = `
    <p>Un cliente respondió en la solicitud <code>${requestId}</code>.</p>
    <p><strong>Empresa:</strong> <code>${companyId}</code></p>
    <blockquote>${preview}</blockquote>
  `;
  await sendEmail(staff, subject, html);
  await createNotification(staffIds, "staff_request_message", `Nuevo mensaje en solicitud ${requestId.slice(0, 8)}`, {
    companyId,
    requestId,
    preview,
  });
}

export async function notifyClientRequestMessage(companyId: string, requestId: string, body: string) {
  const { admins, clients, adminIds, clientIds } = await getCompanyActiveMemberEmails(companyId);
  const recipients = clients.length ? clients : admins;
  const recipientIds = clients.length ? clientIds : adminIds;
  if (!recipients.length) return;
  const preview = formatPreview(body);
  const subject = `Nuevo mensaje de nuestro equipo`;
  const html = `
    <p>Te compartimos una actualización sobre la solicitud <code>${requestId}</code>.</p>
    <blockquote>${preview}</blockquote>
  `;
  await sendEmail(recipients, subject, html);
  await createNotification(recipientIds, "client_request_message", "Nuevo mensaje de nuestro equipo.", {
    companyId,
    requestId,
    preview,
  });
}

export async function notifyStaffKycSubmitted(companyId: string) {
  const staff = staffRecipients();
  if (!staff.length) return;
  const staffIds = await getUserIdsForEmails(staff);
  const subject = `KYC enviado (${companyId})`;
  const html = `
    <p>El cliente completó la información de KYC.</p>
    <p><strong>Empresa:</strong> <code>${companyId}</code></p>
  `;

  await sendEmail(staff, subject, html);
  await createNotification(staffIds, "staff_kyc_submitted", `KYC enviado (${companyId})`, {
    companyId,
  });
}

export async function notifyClientKycApproved(companyId: string) {
  const { admins, clients, adminIds, clientIds } = await getCompanyActiveMemberEmails(companyId);
  const recipients = clients.length ? clients : admins;
  const recipientIds = clients.length ? clientIds : adminIds;
  if (!recipients.length) return;

  const subject = `Verificación KYC aprobada`;
  const html = `
    <p>Hemos aprobado la verificación KYC de tu empresa.</p>
    <p>¡Gracias por completar el proceso!</p>
  `;
  await sendEmail(recipients, subject, html);
  await createNotification(recipientIds, "client_kyc_approved", "Hemos aprobado la verificación KYC de tu empresa.", {
    companyId,
  });
}

export async function notifyStaffCollectionPromise(
  companyId: string,
  requestId: string,
  promiseDate?: string | null,
  promiseAmount?: number | string | null,
) {
  const staff = staffRecipients();
  if (!staff.length) return;
  const staffIds = await getUserIdsForEmails(staff);
  const amountPart = promiseAmount ? ` por ${promiseAmount}` : "";
  const subject = `Promesa de pago registrada (${requestId.slice(0, 8)})`;
  const dateText = promiseDate ? new Date(promiseDate).toLocaleDateString("es-CO") : "sin fecha";
  const html = `
    <p>Se actualizó la promesa de pago para la solicitud <code>${requestId}</code>.</p>
    <p><strong>Empresa:</strong> <code>${companyId}</code></p>
    <p>Compromiso${amountPart} con fecha ${dateText}.</p>
  `;
  await sendEmail(staff, subject, html);
  await createNotification(staffIds, "staff_collection_promise", `Promesa de pago registrada (${requestId.slice(0, 8)})`, {
    companyId,
    requestId,
    promiseDate: promiseDate ?? null,
    promiseAmount: promiseAmount ?? null,
  });
}
