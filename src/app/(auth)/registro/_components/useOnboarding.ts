"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type RawOwner = {
  id?: string;
  full_name?: string | null;
  document_type?: string | null;
  document_number?: string | null;
  email?: string | null;
  ownership_percentage?: number | null;
};

export type OnboardingOwner = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  ownershipPercentage: number | null;
};

export type OnboardingAddress = {
  type: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type OnboardingCompany = {
  id: string;
  name: string;
  legalName: string;
  taxId: string;
  contactEmail: string;
  contactPhone: string;
  billingEmail: string;
  bankAccount: string;
  kycStatus: string | null;
  kycSubmittedAt?: string | null;
  kycApprovedAt?: string | null;
};

export type OnboardingDocument = {
  name: string;
  path: string;
  createdAt?: string;
  updatedAt?: string;
  size?: number;
};

export type OnboardingState = {
  company: OnboardingCompany | null;
  address: OnboardingAddress | null;
  owners: OnboardingOwner[];
  documents: OnboardingDocument[];
  role: string | null;
};

const EMPTY_STATE: OnboardingState = {
  company: null,
  address: null,
  owners: [],
  documents: [],
  role: null,
};

function mapOwner(row: RawOwner): OnboardingOwner {
  return {
    fullName: row.full_name ?? "",
    documentType: row.document_type ?? "",
    documentNumber: row.document_number ?? "",
    email: row.email ?? "",
    ownershipPercentage:
      typeof row.ownership_percentage === "number" ? row.ownership_percentage : row.ownership_percentage ?? null,
  };
}

function mapAddress(row: Record<string, unknown> | null | undefined): OnboardingAddress | null {
  if (!row) return null;
  const get = (key: string) => {
    const value = row[key];
    return typeof value === "string" ? value : "";
  };
  return {
    type: get("type"),
    line1: get("line1"),
    line2: get("line2"),
    city: get("city"),
    state: get("state"),
    postalCode: get("postal_code"),
    country: get("country"),
  };
}

function mapCompany(row: Record<string, unknown> | null | undefined): OnboardingCompany | null {
  if (!row || typeof row !== "object") return null;
  const str = (key: string) => {
    const value = row[key as keyof typeof row];
    return typeof value === "string" ? value : "";
  };
  return {
    id: str("id"),
    name: str("name"),
    legalName: str("legal_name"),
    taxId: str("tax_id"),
    contactEmail: str("contact_email"),
    contactPhone: str("contact_phone"),
    billingEmail: str("billing_email"),
    bankAccount: str("bank_account"),
    kycStatus: typeof row["kyc_status"] === "string" ? String(row["kyc_status"]) : null,
    kycSubmittedAt: typeof row["kyc_submitted_at"] === "string" ? String(row["kyc_submitted_at"]) : null,
    kycApprovedAt: typeof row["kyc_approved_at"] === "string" ? String(row["kyc_approved_at"]) : null,
  };
}

export function useOnboarding(companyId: string | null | undefined) {
  const [state, setState] = useState<OnboardingState>(EMPTY_STATE);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setState(EMPTY_STATE);
      setError("missing-company");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/onboarding/${companyId}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.error === "string" ? payload.error : "unknown";
        throw new Error(message);
      }
      const payload = await response.json();
      const owners = Array.isArray(payload.owners) ? payload.owners.map(mapOwner) : [];
      const documents = Array.isArray(payload.documents) ? payload.documents : [];
      setState({
        company: mapCompany(payload.company),
        address: mapAddress(payload.address),
        owners,
        documents,
        role: typeof payload.role === "string" ? payload.role : null,
      });
    } catch (err) {
      console.error("useOnboarding fetch error", err);
      setState(EMPTY_STATE);
      setError(err instanceof Error ? err.message : "unknown");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const memoState = useMemo(() => state, [state]);

  return { data: memoState, loading, error, refresh: fetchData, setState } as const;
}

export type UseOnboardingReturn = ReturnType<typeof useOnboarding>;
