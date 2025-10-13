import { calculateIRR, calculateTWR } from "./performance";
import { supabaseAdmin } from "./supabase";

export interface InvestorCashflow {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
}

export interface InvestorSummary {
  investedCapital: number;
  cumulativeReturn: {
    value: number;
    percentage: number;
  };
  performance: {
    irr: number | null;
    twr: number | null;
  };
  upcomingCashflows: InvestorCashflow[];
  currency: string;
}

export interface InvestorPosition {
  id: string;
  name: string;
  strategy: string;
  investedAmount: number;
  currentValue: number;
  currency: string;
  irr: number | null;
  twr: number | null;
  updatedAt: string;
}

export interface InvestorTransaction {
  id: string;
  type: "contribution" | "distribution" | "interest" | "fee";
  amount: number;
  currency: string;
  date: string;
  description: string;
  positionId?: string;
}

export interface InvestorStatement {
  id: string;
  period: string;
  generatedAt: string;
  downloadUrl: string;
}

export interface InvestorSummaryFilters {
  upcomingLimit?: number;
  upcomingTypes?: InvestorTransaction["type"][];
  upcomingFromDate?: string;
  upcomingToDate?: string;
}

export interface InvestorTransactionFilters {
  types?: InvestorTransaction["type"][];
  startDate?: string;
  endDate?: string;
  positionId?: string;
  page?: number;
  pageSize?: number;
}

export interface InvestorStatementFilters {
  startPeriod?: string;
  endPeriod?: string;
  page?: number;
  pageSize?: number;
}

type InvestorPositionRow = {
  id: string;
  name: string;
  strategy: string;
  invested_amount: number | null;
  current_value: number | null;
  currency: string;
  updated_at: string;
};

type InvestorTransactionRow = {
  id: string;
  org_id: string;
  type: InvestorTransaction["type"];
  amount: number;
  currency: string;
  date: string;
  description: string | null;
  position_id: string | null;
};

type InvestorStatementRow = {
  id: string;
  org_id: string;
  period: string;
  generated_at: string;
  download_url: string;
};

function sum(values: Array<number | null | undefined>): number {
  let total = 0;

  for (const value of values) {
    if (typeof value === "number") {
      total += value;
    }
  }

  return total;
}

function calculateReturn(
  investedCapital: number,
  currentValue: number,
): { value: number; percentage: number } {
  const value = currentValue - investedCapital;
  const percentage = investedCapital > 0 ? (value / investedCapital) * 100 : 0;

  return {
    value,
    percentage,
  };
}

export async function getInvestorSummary(
  orgId: string,
  filters: InvestorSummaryFilters = {},
): Promise<InvestorSummary> {
  const { data: positionsData, error: positionsError } = await supabaseAdmin
    .from("investor_positions")
    .select("id, name, strategy, invested_amount, current_value, currency, updated_at")
    .eq("org_id", orgId);

  if (positionsError) {
    throw new Error(`Failed to load investor positions: ${positionsError.message}`);
  }

  const positions = (positionsData ?? []) as InvestorPositionRow[];

  const investedCapital = sum(positions.map((position) => position.invested_amount));
  const currentValue = sum(positions.map((position) => position.current_value));
  const cumulativeReturn = calculateReturn(investedCapital, currentValue);
  const currency = positions[0]?.currency ?? "COP";

  const { data: transactionsData, error: transactionsError } = await supabaseAdmin
    .from("investor_transactions")
    .select("id, type, amount, currency, date, description, position_id")
    .eq("org_id", orgId)
    .order("date", { ascending: true });

  if (transactionsError) {
    throw new Error(`Failed to load investor transactions: ${transactionsError.message}`);
  }

  const transactions = (transactionsData ?? []) as InvestorTransactionRow[];
  const normalizedTransactions: InvestorTransaction[] = transactions.map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    date: transaction.date,
    description: transaction.description ?? "",
    positionId: transaction.position_id ?? undefined,
  }));

  const latestValuationDate = positions.reduce<Date | null>((latest, position) => {
    const date = new Date(position.updated_at);
    if (Number.isNaN(date.getTime())) {
      return latest;
    }

    if (!latest || date > latest) {
      return date;
    }

    return latest;
  }, null);

  const valuationDate = latestValuationDate ?? new Date();

  const irr = calculateIRR(normalizedTransactions, {
    valuationAmount: currentValue,
    valuationDate,
  });

  const twr = calculateTWR(normalizedTransactions, {
    valuationAmount: currentValue,
    valuationDate,
  });

  const upcomingLimit = filters.upcomingLimit ?? 3;
  const upcomingTypes = filters.upcomingTypes;
  const nowIso = new Date().toISOString();
  let upcomingQuery = supabaseAdmin
    .from("investor_transactions")
    .select("id, amount, currency, description, type, date")
    .eq("org_id", orgId)
    .gte("date", filters.upcomingFromDate ?? nowIso)
    .lte("date", filters.upcomingToDate ?? "9999-12-31T23:59:59.999Z")
    .order("date", { ascending: true })
    .limit(upcomingLimit);

  if (upcomingTypes?.length) {
    upcomingQuery = upcomingQuery.in("type", upcomingTypes);
  }

  const { data: upcomingTransactionsData, error: upcomingTransactionsError } = await upcomingQuery;

  if (upcomingTransactionsError) {
    throw new Error(
      `Failed to load upcoming transactions: ${upcomingTransactionsError.message}`,
    );
  }

  const upcomingTransactions = (upcomingTransactionsData ?? []) as InvestorTransactionRow[];

  const upcomingCashflows: InvestorCashflow[] = upcomingTransactions.map((transaction) => ({
    id: transaction.id,
    date: transaction.date,
    amount: transaction.amount,
    currency: transaction.currency,
    description: transaction.description ?? "",
  }));

  return {
    investedCapital,
    cumulativeReturn,
    performance: {
      irr,
      twr,
    },
    upcomingCashflows,
    currency,
  };
}

export async function getInvestorPositions(orgId: string): Promise<InvestorPosition[]> {
  const { data, error } = await supabaseAdmin
    .from("investor_positions")
    .select("id, name, strategy, invested_amount, current_value, currency, updated_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load investor positions: ${error.message}`);
  }

  const rows = (data ?? []) as InvestorPositionRow[];

  const { data: transactionsData, error: transactionsError } = await supabaseAdmin
    .from("investor_transactions")
    .select("id, type, amount, currency, date, description, position_id")
    .eq("org_id", orgId)
    .order("date", { ascending: true });

  if (transactionsError) {
    throw new Error(`Failed to load investor transactions: ${transactionsError.message}`);
  }

  const transactions = (transactionsData ?? []) as InvestorTransactionRow[];
  const transactionsByPosition = new Map<string, InvestorTransaction[]>();

  for (const transaction of transactions) {
    if (!transaction.position_id) {
      continue;
    }

    const list = transactionsByPosition.get(transaction.position_id) ?? [];
    list.push({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      date: transaction.date,
      description: transaction.description ?? "",
      positionId: transaction.position_id ?? undefined,
    });
    transactionsByPosition.set(transaction.position_id, list);
  }

  return rows.map((position) => ({
    id: position.id,
    name: position.name,
    strategy: position.strategy,
    investedAmount: position.invested_amount ?? 0,
    currentValue: position.current_value ?? 0,
    currency: position.currency,
    irr:
      calculateIRR(transactionsByPosition.get(position.id) ?? [], {
        valuationAmount: position.current_value ?? 0,
        valuationDate: position.updated_at,
      }) ?? null,
    twr:
      calculateTWR(transactionsByPosition.get(position.id) ?? [], {
        valuationAmount: position.current_value ?? 0,
        valuationDate: position.updated_at,
      }) ?? null,
    updatedAt: position.updated_at,
  }));
}

export async function getInvestorTransactions(
  orgId: string,
  filters: InvestorTransactionFilters = {},
): Promise<InvestorTransaction[]> {
  const pageSize = filters.pageSize ?? 50;
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin
    .from("investor_transactions")
    .select("id, type, amount, currency, date, description, position_id")
    .eq("org_id", orgId)
    .order("date", { ascending: false })
    .range(from, to);

  if (filters.types?.length) {
    query = query.in("type", filters.types);
  }

  if (filters.startDate) {
    query = query.gte("date", filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte("date", filters.endDate);
  }

  if (filters.positionId) {
    query = query.eq("position_id", filters.positionId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load investor transactions: ${error.message}`);
  }

  const rows = (data ?? []) as InvestorTransactionRow[];

  return rows.map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    date: transaction.date,
    description: transaction.description ?? "",
    positionId: transaction.position_id ?? undefined,
  }));
}

export async function getInvestorStatements(
  orgId: string,
  filters: InvestorStatementFilters = {},
): Promise<InvestorStatement[]> {
  const pageSize = filters.pageSize ?? 50;
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin
    .from("investor_statements")
    .select("id, period, generated_at, download_url")
    .eq("org_id", orgId)
    .order("generated_at", { ascending: false })
    .range(from, to);

  if (filters.startPeriod) {
    query = query.gte("period", filters.startPeriod);
  }

  if (filters.endPeriod) {
    query = query.lte("period", filters.endPeriod);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load investor statements: ${error.message}`);
  }

  const rows = (data ?? []) as InvestorStatementRow[];

  return rows.map((statement) => ({
    id: statement.id,
    period: statement.period,
    generatedAt: statement.generated_at,
    downloadUrl: statement.download_url,
  }));
}
