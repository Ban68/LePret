import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

function verifySignature(body: string, signature?: string | null, secret?: string): boolean {
  if (!secret) return true; // si no hay secreto, no verificar (entorno dev)
  if (!signature) return false;
  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(body, 'utf8');
    const digest = hmac.digest('hex');
    // Soportar prefijo tipo "sha256=..." si viene así
    const clean = signature.replace(/^sha256=/i, '');
    return clean.toLowerCase() === digest.toLowerCase();
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const url = new URL(req.url);
    const qpSig = url.searchParams.get('signature');
    const sig = req.headers.get('x-pandadoc-signature') || req.headers.get('x-signature') || qpSig;
    const secret = process.env.PANDADOC_WEBHOOK_SECRET;
    if (!verifySignature(raw, sig, secret)) {
      return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
    }
    const event = JSON.parse(raw || '{}');
    const type: string = event?.event || event?.event_type || '';
    const docId: string | undefined = event?.data?.id || event?.id;
    const state: string | undefined = event?.data?.status || event?.status;
    const tags: string[] | undefined = event?.tags || event?.data?.tags;

    const isCompleted = (
      (type && type.includes('document.completed')) ||
      (Array.isArray(tags) && tags.includes('document.completed')) ||
      type === 'recipient_completed' ||
      state === 'completed' ||
      state === 'completed_document'
    );
    if (docId && isCompleted) {
      // Marcar documento como firmado y la solicitud relacionada como 'signed'
      const { data: doc } = await supabaseAdmin
        .from('documents')
        .update({ status: 'signed' })
        .eq('provider', 'PANDADOC')
        .eq('provider_envelope_id', docId)
        .select('id, company_id, request_id')
        .maybeSingle();

      if (doc?.request_id && doc?.company_id) {
        await supabaseAdmin
          .from('funding_requests')
          .update({ status: 'signed' })
          .eq('id', doc.request_id)
          .eq('company_id', doc.company_id);

        // Descargar PDF final y guardarlo en storage/contracts
        try {
          const baseUrl = process.env.PANDADOC_BASE_URL || 'https://api.pandadoc.com';
          const apiKey = process.env.PANDADOC_API_KEY || '';
          if (apiKey) {
            const res = await fetch(`${baseUrl}/public/v1/documents/${docId}/download?file_type=pdf`, {
              headers: { Authorization: `API-Key ${apiKey}` },
            });
            if (res.ok) {
              const buffer = Buffer.from(await res.arrayBuffer());
              const path = `${doc.company_id}/${doc.id}.pdf`;
              await supabaseAdmin.storage.from('contracts').upload(path, buffer, { contentType: 'application/pdf', upsert: true });
              await supabaseAdmin.from('documents').update({ file_path: path }).eq('id', doc.id);
            }
          }
        } catch {}
        try {
          const { logAudit } = await import("@/lib/audit");
          await logAudit({ company_id: doc.company_id, actor_id: null, entity: 'document', entity_id: doc.id, action: 'signed' });
          await logAudit({ company_id: doc.company_id, actor_id: null, entity: 'request', entity_id: doc.request_id, action: 'status_changed', data: { status: 'signed' } });
        } catch {}
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
