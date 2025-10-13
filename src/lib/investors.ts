import { calculateInternalRateOfReturn, calculateTimeWeightedReturn } from "./performance";
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
    timeWeightedReturn: number | null;
  };
  upcomingCashflows: InvestorCashflow[];
  currency: string;
  portfolioEvolution: PortfolioPoint[];
  strategyDistribution: StrategyDistributionSlice[];
}

export interface PortfolioPoint {
  date: string;
  investedCapital: number;
  portfolioValue: number;
}

export interface StrategyDistributionSlice {
  strategy: string;
  value: number;
  percentage: number;
}

export interface InvestorPosition {
  id: string;
  name: string;
  strategy: string;
  investedAmount: number;
  currentValue: number;
  currency: string;
  irr: number | null;
  timeWeightedReturn: number | null;
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
  irr: number | null;
  updated_at: string;
};

type InvestorTransactionRow = {
  id: string;
  org_id: string;
  type: InvestorTransaction["type"];
  amount: number;
  currency: string;
  date: string | null;
  tx_date?: string | null;
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

function mapTransactionRow(row: InvestorTransactionRow): InvestorTransaction {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    currency: row.currency,
    date: row.date ?? row.tx_date ?? new Date().toISOString(),
    description: row.description ?? "",
    positionId: row.position_id ?? undefined,
  };
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const normalized = new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
  );

  return normalized.toISOString();
}

function findLatestDate(values: Array<string | null | undefined>): string | null {
  const normalizedValues = values
    .map((value) => normalizeDate(value))
    .filter((value): value is string => Boolean(value));

  if (!normalizedValues.length) {
    return null;
  }

  return normalizedValues.reduce((latest, value) => (value > latest ? value : latest));
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
    .select(
      "id, name, strategy, invested_amount, current_value, currency, irr, updated_at",
    )
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
    .select("id, type, amount, currency, date, tx_date, description, position_id")
    .eq("org_id", orgId)
    .order("date", { ascending: true });

  if (transactionsError) {
    throw new Error(`Failed to load investor transactions: ${transactionsError.message}`);
  }

  const allTransactions = (transactionsData ?? []) as InvestorTransactionRow[];
  const mappedTransactions = allTransactions.map(mapTransactionRow);

  const irr = calculateInternalRateOfReturn(mappedTransactions, {
    endingValue: currentValue,
  });

  const twr = calculateTimeWeightedReturn(mappedTransactions, {
    endingValue: currentValue,
  });

  const [portfolioEvolution, strategyDistribution] = await Promise.all([
    getPortfolioEvolution(orgId, { transactions: allTransactions, positions }),
    getStrategyDistribution(orgId, { positions }),
  ]);

  const upcomingLimit = filters.upcomingLimit ?? 3;
  const upcomingTypes = filters.upcomingTypes;
  const nowIso = new Date().toISOString();
  let upcomingQuery = supabaseAdmin
    .from("investor_transactions")
    .select("id, amount, currency, description, type, date, tx_date")
    .eq("org_id", orgId)
    .gte("date", filters.upcomingFromDate ?? nowIso)
    .lte("date", filters.upcomingToDate ?? "9999-12-31T23:59:59.999Z")
    .order("date", { ascending: true })
    .limit(upcomingLimit);

  if (upcomingTypes?.length) {
    upcomingQuery = upcomingQuery.in("type", upcomingTypes);
  }

  const { data: upcomingTransactionsData, error: upcomingError } = await upcomingQuery;

  if (upcomingError) {
    throw new Error(`Failed to load upcoming transactions: ${upcomingError.message}`);
  }

  const upcomingTransactions = (upcomingTransactionsData ?? []) as InvestorTransactionRow[];

  const upcomingCashflows: InvestorCashflow[] = upcomingTransactions.map((transaction) => ({
    id: transaction.id,
    date: transaction.date ?? transaction.tx_date ?? nowIso,
    amount: transaction.amount,
    currency: transaction.currency,
    description: transaction.description ?? "",
  }));

  return {
    investedCapital,
    cumulativeReturn,
    performance: {
      irr,
      timeWeightedReturn: twr,
    },
    upcomingCashflows,
    currency,
    portfolioEvolution,
    strategyDistribution,
  };
}

export async function getPortfolioEvolution(
  orgId: string,
  options: {
    transactions?: InvestorTransactionRow[];
    positions?: InvestorPositionRow[];
  } = {},
): Promise<PortfolioPoint[]> {
  let positions = options.positions;

  if (!positions) {
    const { data, error } = await supabaseAdmin
      .from("investor_positions")
      .select("id, name, strategy, invested_amount, current_value, currency, irr, updated_at")
      .eq("org_id", orgId);

    if (error) {
      throw new Error(`Failed to load investor positions: ${error.message}`);
    }

    positions = (data ?? []) as InvestorPositionRow[];
  }

  let transactions = options.transactions;

  if (!transactions) {
    const { data, error } = await supabaseAdmin
      .from("investor_transactions")
      .select("id, type, amount, currency, date, tx_date, description, position_id")
      .eq("org_id", orgId)
      .order("date", { ascending: true });

    if (error) {
      throw new Error(`Failed to load investor transactions: ${error.message}`);
    }

    transactions = (data ?? []) as InvestorTransactionRow[];
  }

  const sortedTransactions = [...transactions].sort((a, b) => {
    const aDate = normalizeDate(a.date ?? a.tx_date ?? undefined);
    const bDate = normalizeDate(b.date ?? b.tx_date ?? undefined);

    if (!aDate && !bDate) {
      return 0;
    }

    if (!aDate) {
      return -1;
    }

    if (!bDate) {
      return 1;
    }

    return aDate.localeCompare(bDate);
  });

  let runningInvested = 0;
  let runningValue = 0;
  const pointsByDate = new Map<string, PortfolioPoint>();

  for (const transaction of sortedTransactions) {
    const transactionDate = normalizeDate(transaction.date ?? transaction.tx_date ?? undefined);

    if (!transactionDate) {
      continue;
    }

    switch (transaction.type) {
      case "contribution": {
        runningInvested += transaction.amount;
        runningValue += transaction.amount;
        break;
      }
      case "distribution": {
        runningInvested -= transaction.amount;
        runningValue -= transaction.amount;
        break;
      }
      case "interest": {
        runningValue += transaction.amount;
        break;
      }
      case "fee": {
        runningValue -= transaction.amount;
        break;
      }
      default: {
        break;
      }
    }

    runningInvested = Math.max(runningInvested, 0);

    pointsByDate.set(transactionDate, {
      date: transactionDate,
      investedCapital: runningInvested,
      portfolioValue: runningValue,
    });
  }

  const points = Array.from(pointsByDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const investedCapital = sum(positions.map((position) => position.invested_amount));
  const currentValue = sum(positions.map((position) => position.current_value));

  if (investedCapital === 0 && currentValue === 0) {
    return points;
  }

  const latestPositionDate = findLatestDate(positions.map((position) => position.updated_at));
  const latestTransactionDate = points.length > 0 ? points[points.length - 1].date : null;
  const finalDate = latestPositionDate ?? latestTransactionDate ?? normalizeDate(new Date().toISOString());

  if (!finalDate) {
    return points;
  }

  const finalPoint: PortfolioPoint = {
    date: finalDate,
    investedCapital,
    portfolioValue: currentValue,
  };

  if (points.length > 0 && points[points.length - 1].date === finalDate) {
    points[points.length - 1] = finalPoint;
  } else {
    points.push(finalPoint);
  }

  return points;
}

export async function getStrategyDistribution(
  orgId: string,
  options: { positions?: InvestorPositionRow[] } = {},
): Promise<StrategyDistributionSlice[]> {
  let positions = options.positions;

  if (!positions) {
    const { data, error } = await supabaseAdmin
      .from("investor_positions")
      .select("id, name, strategy, invested_amount, current_value, currency, irr, updated_at")
      .eq("org_id", orgId);

    if (error) {
      throw new Error(`Failed to load investor positions: ${error.message}`);
    }

    positions = (data ?? []) as InvestorPositionRow[];
  }

  const totalsByStrategy = positions.reduce<Record<string, number>>((acc, position) => {
    const strategy = position.strategy || "Sin estrategia";
    const value = position.current_value ?? 0;

    if (!acc[strategy]) {
      acc[strategy] = 0;
    }

    acc[strategy] += value;

    return acc;
  }, {});

  const totalValue = Object.values(totalsByStrategy).reduce((acc, value) => acc + value, 0);

  return Object.entries(totalsByStrategy)
    .map(([strategy, value]) => ({
      strategy,
      value,
      percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export async function getInvestorPositions(orgId: string): Promise<InvestorPosition[]> {
  const { data, error } = await supabaseAdmin
    .from("investor_positions")
    .select(
      "id, name, strategy, invested_amount, current_value, currency, irr, updated_at",
    )
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load investor positions: ${error.message}`);
  }

  const rows = (data ?? []) as InvestorPositionRow[];

  const positionIds = rows.map((position) => position.id).filter((id) => Boolean(id));

  let transactionsByPosition: Record<string, InvestorTransaction[]> = {};

  if (positionIds.length > 0) {
    const { data: transactionsData, error: transactionsError } = await supabaseAdmin
      .from("investor_transactions")
      .select("id, type, amount, currency, date, tx_date, description, position_id")
      .eq("org_id", orgId)
      .in("position_id", positionIds)
      .order("date", { ascending: true });

    if (transactionsError) {
      throw new Error(`Failed to load position transactions: ${transactionsError.message}`);
    }

    const transactions = (transactionsData ?? []) as InvestorTransactionRow[];

    transactionsByPosition = transactions.reduce<Record<string, InvestorTransaction[]>>(
      (acc, row) => {
        if (!row.position_id) {
          return acc;
        }

        const mapped = mapTransactionRow(row);
        if (!acc[row.position_id]) {
          acc[row.position_id] = [];
        }

        acc[row.position_id]?.push(mapped);

        return acc;
      },
      {},
    );
  }

  return rows.map((position) => {
    const investedAmount = position.invested_amount ?? 0;
    const currentValue = position.current_value ?? 0;
    const positionTransactions = transactionsByPosition[position.id] ?? [];

    const computedIrr = calculateInternalRateOfReturn(positionTransactions, {
      endingValue: currentValue,
    });

    const computedTwr = calculateTimeWeightedReturn(positionTransactions, {
      endingValue: currentValue,
    });

    return {
      id: position.id,
      name: position.name,
      strategy: position.strategy,
      investedAmount,
      currentValue,
      currency: position.currency,
      irr: computedIrr ?? position.irr ?? null,
      timeWeightedReturn: computedTwr,
      updatedAt: position.updated_at,
    };
  });
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
    .select("id, type, amount, currency, date, tx_date, description, position_id")
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

  return rows.map(mapTransactionRow);
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
