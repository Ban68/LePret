import type { SupabaseClient } from "@supabase/supabase-js";
import { getInvestorCompanyIds } from "./hq-auth";

export type InvestorPosition = {
  id: string;
  investor_company_id: string;
  vehicle_company_id: string | null;
  commitment_amount: string | number | null;
  capital_called: string | number | null;
  capital_returned: string | number | null;
  net_asset_value: string | number | null;
  ownership_percentage: string | number | null;
  irr: string | number | null;
  last_valuation_date: string | null;
  updated_at: string | null;
  vehicles?: { id?: string | null; name?: string | null } | null;
};

export type InvestorDistribution = {
  id: string;
  investor_company_id: string;
  vehicle_company_id: string | null;
  period_start: string | null;
  period_end: string | null;
  gross_amount: string | number | null;
  net_amount: string | number | null;
  reinvested_amount: string | number | null;
  notes: string | null;
  file_path: string | null;
  created_at: string;
  created_by: string | null;
};

export type InvestorDocument = {
  id: string;
  investor_company_id: string;
  vehicle_company_id: string | null;
  name: string;
  doc_type: string;
  file_path: string;
  description: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  vehicles?: { id?: string | null; name?: string | null } | null;
};

export type VehicleParticipation = {
  vehicleId: string | null;
  vehicleName: string;
  commitment: number;
  contributed: number;
  distributions: number;
  nav: number;
  ownership: number;
  netReturn: number;
  irr?: number | null;
};

export type CashflowPoint = {
  period: string;
  netDistributions: number;
  reinvested: number;
};

export type InvestorSummary = {
  totalCommitment: number;
  totalContributed: number;
  totalDistributed: number;
  totalNav: number;
  netReturn: number;
  weightedIrr: number | null;
  vehicles: VehicleParticipation[];
  cashflowTimeline: CashflowPoint[];
};

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeName(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return "Sin asignar";
}

export function buildVehicleParticipation(
  positions: InvestorPosition[],
  distributions: InvestorDistribution[],
): VehicleParticipation[] {
  const distributionByVehicle = new Map<string | null, number>();
  distributions.forEach((row) => {
    const vehicleId = row.vehicle_company_id ?? null;
    const current = distributionByVehicle.get(vehicleId) ?? 0;
    distributionByVehicle.set(vehicleId, current + toNumber(row.net_amount));
  });

  return positions.map((row) => {
    const vehicleId = row.vehicle_company_id ?? null;
    const distributionsTotal = distributionByVehicle.get(vehicleId) ?? 0;
    const commitment = toNumber(row.commitment_amount);
    const contributed = toNumber(row.capital_called);
    const nav = toNumber(row.net_asset_value);
    const netReturn = distributionsTotal + nav - contributed;
    const ownership = toNumber(row.ownership_percentage);
    const irrValue = toNumber(row.irr);
    const vehicleName = normalizeName(row.vehicles?.name ?? null);

    return {
      vehicleId,
      vehicleName,
      commitment,
      contributed,
      distributions: distributionsTotal,
      nav,
      ownership,
      netReturn,
      irr: Number.isFinite(irrValue) && irrValue !== 0 ? irrValue : null,
    } satisfies VehicleParticipation;
  });
}

export function buildCashflowTimeline(distributions: InvestorDistribution[]): CashflowPoint[] {
  const bucket = new Map<string, { net: number; reinvested: number }>();

  distributions.forEach((row) => {
    const period = (row.period_end || row.period_start || "").slice(0, 7);
    if (!period) {
      return;
    }
    const current = bucket.get(period) ?? { net: 0, reinvested: 0 };
    current.net += toNumber(row.net_amount);
    current.reinvested += toNumber(row.reinvested_amount);
    bucket.set(period, current);
  });

  return Array.from(bucket.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([period, values]) => ({
      period,
      netDistributions: values.net,
      reinvested: values.reinvested,
    }));
}

export function summarizePortfolio(
  positions: InvestorPosition[],
  distributions: InvestorDistribution[],
): InvestorSummary {
  const vehicles = buildVehicleParticipation(positions, distributions);

  const totalCommitment = vehicles.reduce((acc, row) => acc + row.commitment, 0);
  const totalContributed = vehicles.reduce((acc, row) => acc + row.contributed, 0);
  const totalDistributed = vehicles.reduce((acc, row) => acc + row.distributions, 0);
  const totalNav = vehicles.reduce((acc, row) => acc + row.nav, 0);
  const netReturn = totalDistributed + totalNav - totalContributed;

  const irrNumerator = vehicles.reduce((acc, row) => {
    if (typeof row.irr === "number" && Number.isFinite(row.irr)) {
      return acc + row.irr * row.contributed;
    }
    return acc;
  }, 0);
  const irrDenominator = vehicles.reduce((acc, row) => acc + row.contributed, 0);
  const weightedIrr = irrDenominator > 0 ? irrNumerator / irrDenominator : null;

  const cashflowTimeline = buildCashflowTimeline(distributions);

  return {
    totalCommitment,
    totalContributed,
    totalDistributed,
    totalNav,
    netReturn,
    weightedIrr,
    vehicles,
    cashflowTimeline,
  } satisfies InvestorSummary;
}

export async function fetchInvestorPositions(
  supabase: SupabaseClient,
  investorCompanyId: string,
): Promise<InvestorPosition[]> {
  const { data, error } = await supabase
    .from("investor_positions")
    .select(
      "id, investor_company_id, vehicle_company_id, commitment_amount, capital_called, capital_returned, net_asset_value, ownership_percentage, irr, last_valuation_date, updated_at, vehicles:vehicle_company_id (id, name)"
    )
    .eq("investor_company_id", investorCompanyId)
    .order("vehicle_company_id", { ascending: true });

  if (error || !data) {
    console.error("Failed to load investor positions", error);
    return [];
  }

  return data as InvestorPosition[];
}

export async function fetchInvestorDistributions(
  supabase: SupabaseClient,
  investorCompanyId: string,
): Promise<InvestorDistribution[]> {
  const { data, error } = await supabase
    .from("investor_distributions")
    .select(
      "id, investor_company_id, vehicle_company_id, period_start, period_end, gross_amount, net_amount, reinvested_amount, notes, file_path, created_at, created_by"
    )
    .eq("investor_company_id", investorCompanyId)
    .order("period_end", { ascending: false, nullsFirst: false });

  if (error || !data) {
    console.error("Failed to load investor distributions", error);
    return [];
  }

  return data as InvestorDistribution[];
}

export async function fetchInvestorDocuments(
  supabase: SupabaseClient,
  investorCompanyId: string,
): Promise<InvestorDocument[]> {
  const { data, error } = await supabase
    .from("investor_documents")
    .select(
      "id, investor_company_id, vehicle_company_id, name, doc_type, file_path, description, uploaded_at, uploaded_by, vehicles:vehicle_company_id (id, name)"
    )
    .eq("investor_company_id", investorCompanyId)
    .order("uploaded_at", { ascending: false });

  if (error || !data) {
    console.error("Failed to load investor documents", error);
    return [];
  }

  return data as InvestorDocument[];
}

export async function buildInvestorDashboard(
  supabase: SupabaseClient,
  investorCompanyId: string,
): Promise<InvestorSummary> {
  const [positions, distributions] = await Promise.all([
    fetchInvestorPositions(supabase, investorCompanyId),
    fetchInvestorDistributions(supabase, investorCompanyId),
  ]);

  return summarizePortfolio(positions, distributions);
}

export async function getDefaultInvestorCompanyId(userId?: string | null): Promise<string | null> {
  const ids = await getInvestorCompanyIds(userId);
  return ids.length > 0 ? ids[0] : null;
}

export async function fetchInvestorCompanyProfile(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ id: string; name: string | null; type: string | null } | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, type")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load investor company profile", error);
    return null;
  }

  return (data as { id: string; name: string | null; type: string | null } | null) ?? null;
}
