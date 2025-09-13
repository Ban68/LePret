import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";

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

export async function getCompanyActiveMemberEmails(companyId: string): Promise<{ owners: string[]; admins: string[]; clients: string[]; all: string[]; }> {
  const { data: members, error } = await supabaseAdmin
    .from("memberships")
    .select("user_id, role, status")
    .eq("company_id", companyId)
    .eq("status", "ACTIVE");
  if (error) return { owners: [], admins: [], clients: [], all: [] };
  const userIds = (members || []).map((m: any) => m.user_id);
  if (!userIds.length) return { owners: [], admins: [], clients: [], all: [] };
  const { data: users } = await supabaseAdmin.from("auth.users" as any).select("id, email").in("id", userIds);
  const emailById: Record<string, string> = {};
  (users || []).forEach((u: any) => { if (u.email) emailById[u.id] = u.email; });
  const owners: string[] = [];
  const admins: string[] = [];
  const clients: string[] = [];
  (members || []).forEach((m: any) => {
    const email = emailById[m.user_id];
    if (!email) return;
    const role = String(m.role || "").toUpperCase();
    if (role === "OWNER" || role === "ADMIN") admins.push(email);
    if (role === "CLIENT" || role === "VIEWER" || role === "OPERATOR") clients.push(email);
    if (role === "OWNER") owners.push(email);
  });
  const all = Array.from(new Set([...owners, ...admins, ...clients]));
  return { owners, admins, clients, all };
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
  const subject = `Nueva solicitud creada (${companyId})`;
  const html = `<p>Se creó una nueva solicitud</p><p>Empresa: <code>${companyId}</code></p><p>Solicitud: <code>${requestId}</code></p>`;
  await sendEmail(staff, subject, html);
}

export async function notifyClientOfferGenerated(companyId: string, offerId: string) {
  const { admins, clients } = await getCompanyActiveMemberEmails(companyId);
  const recipients = clients.length ? clients : admins; // fallback a admins si no hay clientes
  if (!recipients.length) return;
  const subject = `Tu oferta está lista (#${offerId.slice(0, 8)})`;
  const html = `<p>Hemos generado una oferta para tu solicitud.</p><p>Identificador de oferta: <code>${offerId}</code></p>`;
  await sendEmail(recipients, subject, html);
}

export async function notifyStaffOfferAccepted(companyId: string, offerId: string) {
  const staff = staffRecipients();
  if (!staff.length) return;
  const subject = `Oferta aceptada (${companyId})`;
  const html = `<p>El cliente aceptó una oferta.</p><p>Empresa: <code>${companyId}</code></p><p>Oferta: <code>${offerId}</code></p>`;
  await sendEmail(staff, subject, html);
}

// Flexible helper: accepts either a signUrl (string) or an options object
// { signUrl?: string, appUrl?: string }
export async function notifyClientContractReady(
  companyId: string,
  options: string | { signUrl?: string | null; appUrl?: string | null }
) {
  const { admins, clients } = await getCompanyActiveMemberEmails(companyId);
  const recipients = clients.length ? clients : admins;
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
}

export async function notifyClientFunded(companyId: string, requestId: string) {
  const { admins, clients } = await getCompanyActiveMemberEmails(companyId);
  const recipients = clients.length ? clients : admins;
  if (!recipients.length) return;
  const subject = `Desembolso realizado`;
  const html = `<p>Tu operación ha sido desembolsada.</p><p>Solicitud: <code>${requestId}</code></p>`;
  await sendEmail(recipients, subject, html);
}

export async function notifyClientNeedsDocs(companyId: string, note?: string) {
  const { admins, clients } = await getCompanyActiveMemberEmails(companyId);
  const recipients = clients.length ? clients : admins;
  if (!recipients.length) return;
  const subject = `Documentación requerida`;
  const html = `<p>Necesitamos documentos adicionales para continuar.</p>${note ? `<p>${note}</p>` : ''}`;
  await sendEmail(recipients, subject, html);
}
