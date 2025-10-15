import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase";
import { isBackofficeAllowed } from "@/lib/hq-auth";
import { normalizeKycStatus } from "@/lib/organizations";
import { notifyClientKycApproved, notifyClientNeedsDocs } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ companyId: string }> };

type CompanyRow = {
  id: string;
  name: string | null;
  type: string | null;
  legal_name: string | null;
  tax_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  billing_email: string | null;
  bank_account: string | null;
  kyc_status: string | null;
  kyc_submitted_at: string | null;
  kyc_approved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AddressRow = {
  id: string;
  type: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  updated_at: string | null;
};

type OwnerRow = {
  id: string;
  full_name: string | null;
  document_type: string | null;
  document_number: string | null;
  email: string | null;
  ownership_percentage: number | null;
};

type DocumentItem = {
  name: string;
  path: string;
  createdAt: string | null;
  updatedAt: string | null;
  size: number | null;
  downloadUrl: string | null;
};

function extractString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizePercentage(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function requireHqSession() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { supabase, session: null, allowed: false } as const;
  }
  const allowed = await isBackofficeAllowed(session.user?.id, session.user?.email);
  return { supabase, session, allowed } as const;
}

export async function GET(_req: Request, context: RouteParams) {
  try {
    const { companyId } = await context.params;
    if (!companyId) {
      return NextResponse.json({ ok: false, error: "Missing company" }, { status: 400 });
    }

    const { session, allowed } = await requireHqSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select<CompanyRow>(
        "id, name, type, legal_name, tax_id, contact_email, contact_phone, billing_email, bank_account, kyc_status, kyc_submitted_at, kyc_approved_at, created_at, updated_at"
      )
      .eq("id", companyId)
      .maybeSingle();
    if (companyError) {
      console.error("hq kyc company fetch error", companyError);
      return NextResponse.json({ ok: false, error: "company_fetch_failed" }, { status: 500 });
    }
    if (!company) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const { data: addresses, error: addressesError } = await supabaseAdmin
      .from("addresses")
      .select("id, type, line1, line2, city, state, postal_code, country, updated_at")
      .eq("company_id", companyId);
    if (addressesError && addressesError.code !== "42P01") {
      console.error("hq kyc addresses fetch error", addressesError);
      return NextResponse.json({ ok: false, error: "address_fetch_failed" }, { status: 500 });
    }

    const { data: owners, error: ownersError } = await supabaseAdmin
      .from("beneficial_owners")
      .select("id, full_name, document_type, document_number, email, ownership_percentage")
      .eq("company_id", companyId);
    if (ownersError && ownersError.code !== "42P01") {
      console.error("hq kyc owners fetch error", ownersError);
      return NextResponse.json({ ok: false, error: "owners_fetch_failed" }, { status: 500 });
    }

    const { data: docs, error: docsError } = await supabaseAdmin.storage
      .from("kyc-documents")
      .list(companyId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (docsError && docsError.name !== "StorageApiError") {
      console.error("hq kyc documents list error", docsError);
    }

    const primaryAddress = Array.isArray(addresses)
      ? (addresses as AddressRow[]).find((row) => (row.type || "").toUpperCase() === "LEGAL") ?? (addresses as AddressRow[])[0] ?? null
      : null;

    let documents: DocumentItem[] = [];
    if (Array.isArray(docs) && docs.length > 0) {
      documents = await Promise.all(
        docs.map(async (doc) => {
          const path = `${companyId}/${doc.name}`;
          let signedUrl: string | null = null;
          try {
            const { data: signedData, error: signedError } = await supabaseAdmin.storage
              .from("kyc-documents")
              .createSignedUrl(path, 60 * 10);
            if (!signedError && signedData?.signedUrl) {
              signedUrl = signedData.signedUrl;
            }
            if (signedError) {
              console.warn("hq kyc signed url error", signedError);
            }
          } catch (err) {
            console.warn("hq kyc signed url throw", err);
          }

          const size = typeof doc.metadata?.size === "number"
            ? doc.metadata.size
            : typeof doc.metadata?.filesize === "number"
              ? doc.metadata.filesize
              : null;

          return {
            name: doc.name,
            path,
            createdAt: doc.created_at ?? null,
            updatedAt: doc.updated_at ?? null,
            size: typeof size === "number" ? size : null,
            downloadUrl: signedUrl,
          };
        })
      );
    }

    const normalizedStatus = normalizeKycStatus(company.kyc_status);

    return NextResponse.json({
      ok: true,
      company: {
        id: company.id,
        name: extractString(company.name),
        type: extractString(company.type),
        legalName: extractString(company.legal_name),
        taxId: extractString(company.tax_id),
        contactEmail: extractString(company.contact_email),
        contactPhone: extractString(company.contact_phone),
        billingEmail: extractString(company.billing_email),
        bankAccount: extractString(company.bank_account),
        status: normalizedStatus,
        rawStatus: company.kyc_status,
        submittedAt: company.kyc_submitted_at,
        approvedAt: company.kyc_approved_at,
        createdAt: company.created_at,
        updatedAt: company.updated_at,
      },
      address: primaryAddress
        ? {
            line1: extractString(primaryAddress.line1),
            line2: extractString(primaryAddress.line2),
            city: extractString(primaryAddress.city),
            state: extractString(primaryAddress.state),
            postalCode: extractString(primaryAddress.postal_code),
            country: extractString(primaryAddress.country),
            updatedAt: primaryAddress.updated_at,
          }
        : null,
      owners: Array.isArray(owners)
        ? (owners as OwnerRow[]).map((owner) => ({
            id: owner.id,
            name: extractString(owner.full_name),
            documentType: extractString(owner.document_type),
            documentNumber: extractString(owner.document_number),
            email: extractString(owner.email),
            ownershipPercentage: normalizePercentage(owner.ownership_percentage),
          }))
        : [],
      documents,
    });
  } catch (error) {
    console.error("GET /api/hq/kyc/[companyId] error", error);
    return NextResponse.json({ ok: false, error: "unexpected" }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: RouteParams) {
  try {
    const { companyId } = await context.params;
    if (!companyId) {
      return NextResponse.json({ ok: false, error: "Missing company" }, { status: 400 });
    }

    const { session, allowed } = await requireHqSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const nextStatusValue = body && typeof body.status === "string" ? body.status : null;
    const note = body && typeof body.note === "string" ? body.note.trim() : "";

    const nextStatus = normalizeKycStatus(nextStatusValue);
    if (!nextStatus) {
      return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
    }

    const { data: current, error: currentError } = await supabaseAdmin
      .from("companies")
      .select("kyc_status, kyc_submitted_at, kyc_approved_at")
      .eq("id", companyId)
      .maybeSingle();
    if (currentError) {
      console.error("hq kyc current fetch error", currentError);
      return NextResponse.json({ ok: false, error: "status_fetch_failed" }, { status: 500 });
    }
    if (!current) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const previousStatus = normalizeKycStatus(current.kyc_status);
    const nowISO = new Date().toISOString();

    if (previousStatus === nextStatus && !note) {
      return NextResponse.json({ ok: true, status: nextStatus, unchanged: true });
    }

    const updateData: Record<string, unknown> = {
      kyc_status: nextStatus,
      updated_at: nowISO,
    };

    if (nextStatus === "APPROVED") {
      updateData.kyc_approved_at = nowISO;
      if (!current.kyc_submitted_at) {
        updateData.kyc_submitted_at = nowISO;
      }
    } else if (nextStatus === "SUBMITTED") {
      updateData.kyc_submitted_at = nowISO;
      updateData.kyc_approved_at = null;
    } else {
      updateData.kyc_approved_at = null;
    }

    if (previousStatus !== nextStatus) {
      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update(updateData)
        .eq("id", companyId);
      if (updateError) {
        console.error("hq kyc status update error", updateError);
        return NextResponse.json({ ok: false, error: "status_update_failed" }, { status: 500 });
      }
    } else {
      // Still update timestamp even if status unchanged
      const { error: touchError } = await supabaseAdmin
        .from("companies")
        .update({ updated_at: nowISO })
        .eq("id", companyId);
      if (touchError) {
        console.error("hq kyc status touch error", touchError);
      }
    }

    if (nextStatus === "APPROVED" && previousStatus !== "APPROVED") {
      await notifyClientKycApproved(companyId);
    }
    if ((nextStatus === "IN_PROGRESS" || nextStatus === "REJECTED") && note) {
      await notifyClientNeedsDocs(companyId, note);
    }

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (error) {
    console.error("PATCH /api/hq/kyc/[companyId] error", error);
    return NextResponse.json({ ok: false, error: "unexpected" }, { status: 500 });
  }
}
