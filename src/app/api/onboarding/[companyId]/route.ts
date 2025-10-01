import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeMemberRole, canManageMembership } from "@/lib/rbac";
import { normalizeKycStatus } from "@/lib/organizations";
import { supabaseAdmin } from "@/lib/supabase";
import { notifyStaffKycSubmitted, notifyClientKycApproved } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireSession() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  if (!session) {
    return { supabase, session: null } as const;
  }
  return { supabase, session } as const;
}

async function ensureMembership(supabase: SupabaseClient, companyId: string, userId: string) {
  const { data, error } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("onboarding membership error", error);
    throw new Error("membership_error");
  }
  if (!data || data.status !== "ACTIVE") {
    return { allowed: false, role: null as string | null };
  }
  return { allowed: true, role: data.role ?? null };
}

export async function GET(
  req: Request,
  { params }: { params: { companyId: string } },
) {
  try {
    const { supabase, session } = await requireSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const companyId = params.companyId;
    if (!companyId) {
      return NextResponse.json({ ok: false, error: "Missing company" }, { status: 400 });
    }

    const membership = await ensureMembership(supabase, companyId, session.user.id);
    if (!membership.allowed) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select(
        "id, name, legal_name, tax_id, contact_email, contact_phone, billing_email, bank_account, kyc_status, kyc_submitted_at, kyc_approved_at",
      )
      .eq("id", companyId)
      .maybeSingle();
    if (companyError) {
      console.error("onboarding company load error", companyError);
      return NextResponse.json({ ok: false, error: "company_fetch_failed" }, { status: 500 });
    }

    const { data: addresses, error: addressError } = await supabaseAdmin
      .from("addresses")
      .select("id, type, line1, line2, city, state, postal_code, country")
      .eq("company_id", companyId);
    if (addressError && addressError.code !== "42P01") {
      console.error("onboarding address load error", addressError);
      return NextResponse.json({ ok: false, error: "address_fetch_failed" }, { status: 500 });
    }

    const { data: owners, error: ownersError } = await supabaseAdmin
      .from("beneficial_owners")
      .select("id, full_name, document_type, document_number, email, ownership_percentage")
      .eq("company_id", companyId);
    if (ownersError && ownersError.code !== "42P01") {
      console.error("onboarding owners load error", ownersError);
      return NextResponse.json({ ok: false, error: "owners_fetch_failed" }, { status: 500 });
    }

    const { data: docs, error: docsError } = await supabaseAdmin.storage
      .from("kyc-documents")
      .list(companyId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (docsError && docsError.name !== "StorageApiError") {
      console.error("onboarding documents load error", docsError);
    }

    const primaryAddress = Array.isArray(addresses)
      ? addresses.find((addr) => (addr as { type?: string }).type === "LEGAL") ?? addresses[0] ?? null
      : null;

    const documentList = Array.isArray(docs)
      ? docs.map((doc) => ({
          name: doc.name,
          path: `${companyId}/${doc.name}`,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
          size: doc.size,
        }))
      : [];

    return NextResponse.json({
      ok: true,
      company,
      address: primaryAddress,
      owners: owners ?? [],
      documents: documentList,
      role: normalizeMemberRole(membership.role) ?? null,
    });
  } catch (error) {
    console.error("GET /api/onboarding error", error);
    return NextResponse.json({ ok: false, error: "unexpected" }, { status: 500 });
  }
}

function sanitizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function PUT(
  req: Request,
  { params }: { params: { companyId: string } },
) {
  try {
    const { supabase, session } = await requireSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const companyId = params.companyId;
    if (!companyId) {
      return NextResponse.json({ ok: false, error: "Missing company" }, { status: 400 });
    }

    const membership = await ensureMembership(supabase, companyId, session.user.id);
    const role = normalizeMemberRole(membership.role);
    if (!membership.allowed || !canManageMembership(role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const section = typeof (payload as { section?: unknown }).section === "string" ? (payload as { section: string }).section : "";

    if (section === "company") {
      const companyData = (payload as { company?: Record<string, unknown> }).company ?? {};
      const updates: Record<string, unknown> = {
        legal_name: sanitizeString(companyData.legalName),
        tax_id: sanitizeString(companyData.taxId),
        contact_email: sanitizeString(companyData.contactEmail),
        contact_phone: sanitizeString(companyData.contactPhone),
        billing_email: sanitizeString(companyData.billingEmail),
        bank_account: sanitizeString(companyData.bankAccount),
        updated_at: new Date().toISOString(),
      };
      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update(updates)
        .eq("id", companyId);
      if (updateError) {
        console.error("onboarding company update error", updateError);
        return NextResponse.json({ ok: false, error: "company_update_failed" }, { status: 500 });
      }

      if (companyData.address && typeof companyData.address === "object") {
        const address = companyData.address as Record<string, unknown>;
        const addressRow = {
          company_id: companyId,
          type: sanitizeString(address.type) ?? "LEGAL",
          line1: sanitizeString(address.line1),
          line2: sanitizeString(address.line2),
          city: sanitizeString(address.city),
          state: sanitizeString(address.state),
          postal_code: sanitizeString(address.postalCode),
          country: sanitizeString(address.country),
          updated_at: new Date().toISOString(),
        };
        const { error: deleteError } = await supabaseAdmin
          .from("addresses")
          .delete()
          .eq("company_id", companyId)
          .eq("type", addressRow.type ?? "LEGAL");
        if (deleteError && deleteError.code !== "42P01") {
          console.error("onboarding address delete error", deleteError);
          return NextResponse.json({ ok: false, error: "address_update_failed" }, { status: 500 });
        }
        if (addressRow.line1) {
          const { error: addressInsertError } = await supabaseAdmin
            .from("addresses")
            .insert(addressRow);
          if (addressInsertError && addressInsertError.code !== "42P01") {
            console.error("onboarding address update error", addressInsertError);
            return NextResponse.json({ ok: false, error: "address_update_failed" }, { status: 500 });
          }
        }
      }

      return NextResponse.json({ ok: true });
    }

    if (section === "owners") {
      const owners = Array.isArray((payload as { owners?: unknown }).owners)
        ? ((payload as { owners: unknown[] }).owners).map((owner) => owner ?? {})
        : [];

      const { error: ownersDeleteError } = await supabaseAdmin.from("beneficial_owners").delete().eq("company_id", companyId);
      if (ownersDeleteError && ownersDeleteError.code !== "42P01") {
        console.error("onboarding owners delete error", ownersDeleteError);
        return NextResponse.json({ ok: false, error: "owners_update_failed" }, { status: 500 });
      }

      const rows = owners
        .map((owner) => ({
          full_name: sanitizeString((owner as Record<string, unknown>).fullName),
          document_type: sanitizeString((owner as Record<string, unknown>).documentType),
          document_number: sanitizeString((owner as Record<string, unknown>).documentNumber),
          email: sanitizeString((owner as Record<string, unknown>).email),
          ownership_percentage: typeof (owner as Record<string, unknown>).ownershipPercentage === "number"
            ? (owner as Record<string, unknown>).ownershipPercentage
            : parseFloat(String((owner as Record<string, unknown>).ownershipPercentage ?? "")) || null,
        }))
        .filter((row) => row.full_name && row.document_number);

      if (rows.length) {
        const insertRows = rows.map((row) => ({ ...row, company_id: companyId }));
        const { error: insertError } = await supabaseAdmin.from("beneficial_owners").insert(insertRows);
        if (insertError && insertError.code !== "42P01") {
          console.error("onboarding owners insert error", insertError);
          return NextResponse.json({ ok: false, error: "owners_update_failed" }, { status: 500 });
        }
      }

      return NextResponse.json({ ok: true });
    }

    if (section === "status") {
      const nextStatus = normalizeKycStatus((payload as { status?: unknown }).status ?? null);
      if (!nextStatus) {
        return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
      }

      const { data: current, error: currentError } = await supabaseAdmin
        .from("companies")
        .select("kyc_status")
        .eq("id", companyId)
        .maybeSingle();
      if (currentError) {
        console.error("onboarding status load error", currentError);
        return NextResponse.json({ ok: false, error: "status_fetch_failed" }, { status: 500 });
      }

      const previousStatus = normalizeKycStatus(current?.kyc_status ?? null);

      const updateData: Record<string, unknown> = { kyc_status: nextStatus, updated_at: new Date().toISOString() };
      if (nextStatus === "SUBMITTED") {
        updateData.kyc_submitted_at = new Date().toISOString();
      }
      if (nextStatus === "APPROVED") {
        updateData.kyc_approved_at = new Date().toISOString();
      }

      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update(updateData)
        .eq("id", companyId);
      if (updateError) {
        console.error("onboarding status update error", updateError);
        return NextResponse.json({ ok: false, error: "status_update_failed" }, { status: 500 });
      }

      if (nextStatus === "SUBMITTED" && previousStatus !== "SUBMITTED") {
        await notifyStaffKycSubmitted(companyId);
      }
      if (nextStatus === "APPROVED" && previousStatus !== "APPROVED") {
        await notifyClientKycApproved(companyId);
      }

      return NextResponse.json({ ok: true, status: nextStatus });
    }

    return NextResponse.json({ ok: false, error: "Unknown section" }, { status: 400 });
  } catch (error) {
    console.error("PUT /api/onboarding error", error);
    return NextResponse.json({ ok: false, error: "unexpected" }, { status: 500 });
  }
}
