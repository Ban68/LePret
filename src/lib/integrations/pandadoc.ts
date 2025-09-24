// PandaDoc integration via REST API

export type PandaDocRecipient = { email: string; firstName?: string; lastName?: string; role?: string };
export type PandaDocCreateDocInput = {
  name: string;
  recipients: PandaDocRecipient[];
  templateId: string;
  variables?: Record<string, string | number>;
  send?: boolean; // if true, PandaDoc enviará correos a los firmantes
  subject?: string;
  message?: string;
};

const baseUrl = process.env.PANDADOC_BASE_URL || "https://api.pandadoc.com";
const apiKey = process.env.PANDADOC_API_KEY || "";

function headersJson() {
  if (!apiKey) throw new Error("Missing PANDADOC_API_KEY environment variable");
  return {
    Authorization: `API-Key ${apiKey}`,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

async function pdFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...(headersJson()), ...(init?.headers || {}) },
    // Next fetch defaults are fine; ensure no cache
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`PandaDoc ${path} ${res.status}: ${txt || res.statusText}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export async function sendDocument(documentId: string, subject?: string, message?: string) {
  const body: Record<string, unknown> = {};
  if (subject) body.subject = subject;
  if (message) body.message = message;
  // Nota: la API pública admite este endpoint para enviar emails nativos
  return pdFetch(`/public/v1/documents/${documentId}/send`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createDocumentFromTemplate(input: PandaDocCreateDocInput): Promise<{ id: string; status?: string }> {
  const tokensArr = Object.entries(input.variables || {}).map(([name, value]) => ({ name, value: String(value) }));
  const tokensDict: Record<string, string> = {};
  for (const t of tokensArr) tokensDict[t.name] = t.value as string;

  const recipientsArr = (input.recipients || []).map((r) => ({
    email: r.email,
    first_name: r.firstName,
    last_name: r.lastName,
    role: r.role,
  }));
  const baseBody: Record<string, unknown> = {
    name: input.name,
    template_uuid: input.templateId,
    recipients: recipientsArr,
    tokens: tokensArr,
  };
  if (input.send) {
    baseBody.send = true; // algunos entornos lo aceptan; no añadimos subject/message aquí
  }
  try {
    const data = await pdFetch<{ id: string; status?: string }>("/public/v1/documents", { method: "POST", body: JSON.stringify(baseBody) });
    if (input.send) {
      try { await sendDocument(data.id, input.subject, input.message); } catch {}
    }
    return { id: data.id, status: data.status };
  } catch (e: unknown) {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    // Fallback: algunas cuentas esperan 'tokens' como diccionario
    if (msg.includes('expected a dictionary')) {
      const altBody: Record<string, unknown> = {
        name: input.name,
        template_uuid: input.templateId,
        recipients: recipientsArr, // sigue siendo lista
        tokens: tokensDict,
      };
      if (input.send) { altBody.send = true; }
      const data = await pdFetch<{ id: string; status?: string }>("/public/v1/documents", { method: "POST", body: JSON.stringify(altBody) });
      if (input.send) {
        try { await sendDocument(data.id, input.subject, input.message); } catch {}
      }
      return { id: data.id, status: data.status };
    }
    throw e;
  }
}

export async function createRecipientSession(documentId: string, recipientEmail: string, lifetimeSeconds = 900): Promise<{ url: string }> {
  const payload: { recipient: string; lifetime: number; is_embedded: boolean } = { recipient: recipientEmail, lifetime: lifetimeSeconds, is_embedded: false };
  const data = await pdFetch<{ url: string }>(`/public/v1/documents/${documentId}/session`, { method: "POST", body: JSON.stringify(payload) });
  // PandaDoc devuelve { id, recipient, url, expires_at }
  return { url: data.url };
}

// Backwards-compatible helper used by our API route
export async function createSignatureEnvelope(input: PandaDocCreateDocInput) {
  const doc = await createDocumentFromTemplate(input);
  // Crear link de firma (opcional). Si falla, devolvemos sin URL.
  let signUrl: string | null = null;
  try {
    const first = input.recipients[0];
    if (first?.email) {
      const sess = await createRecipientSession(doc.id, first.email);
      signUrl = sess.url;
    }
  } catch {}
  return {
    provider: "PANDADOC",
    envelopeId: doc.id,
    status: doc.status ?? "created",
    signUrl,
    input,
  };
}
