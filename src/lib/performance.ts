import type { InvestorTransaction } from "./investors";

type PerformanceTransaction = Pick<InvestorTransaction, "amount" | "date" | "type">;

type Cashflow = {
  amount: number;
  date: Date;
};

function parseDate(value: string): Date | null {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function normalizeAmount(transaction: PerformanceTransaction): number | null {
  const amount = Number(transaction.amount);

  if (!Number.isFinite(amount)) {
    return null;
  }

  switch (transaction.type) {
    case "contribution":
    case "fee":
      return -Math.abs(amount);
    case "distribution":
    case "interest":
      return Math.abs(amount);
    default:
      return null;
  }
}

function mapTransactionsToCashflows(
  transactions: PerformanceTransaction[],
): Cashflow[] {
  return transactions
    .map((transaction) => {
      const date = parseDate(transaction.date);
      const amount = normalizeAmount(transaction);

      if (!date || amount === null || amount === 0) {
        return null;
      }

      return { amount, date } satisfies Cashflow;
    })
    .filter((value): value is Cashflow => value !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function daysBetween(base: Date, compare: Date): number {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const diff = compare.getTime() - base.getTime();

  return diff / millisecondsPerDay;
}

export function calculateInternalRateOfReturn(
  transactions: PerformanceTransaction[],
  options: { endingValue?: number; asOfDate?: Date | string } = {},
): number | null {
  const cashflows = mapTransactionsToCashflows(transactions);

  const { endingValue, asOfDate } = options;

  if (endingValue !== undefined && Number.isFinite(endingValue)) {
    const endingDate =
      typeof asOfDate === "string"
        ? parseDate(asOfDate)
        : asOfDate instanceof Date
          ? asOfDate
          : new Date();

    if (endingDate) {
      cashflows.push({ amount: Number(endingValue), date: endingDate });
    }
  }

  if (cashflows.length === 0) {
    return null;
  }

  const hasPositive = cashflows.some((flow) => flow.amount > 0);
  const hasNegative = cashflows.some((flow) => flow.amount < 0);

  if (!hasPositive || !hasNegative) {
    return null;
  }

  const baseDate = cashflows[0].date;

  function npv(rate: number): number {
    return cashflows.reduce((acc, flow) => {
      const t = daysBetween(baseDate, flow.date) / 365;
      return acc + flow.amount / (1 + rate) ** t;
    }, 0);
  }

  function dnpv(rate: number): number {
    return cashflows.reduce((acc, flow) => {
      const t = daysBetween(baseDate, flow.date) / 365;
      if (t === 0) {
        return acc;
      }
      return acc - (t * flow.amount) / (1 + rate) ** (t + 1);
    }, 0);
  }

  const maxIterations = 100;
  const tolerance = 1e-7;
  let rate = 0.1; // Initial guess of 10%

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (rate <= -0.9999999999) {
      rate = -0.9999999999;
    }

    const value = npv(rate);
    const derivative = dnpv(rate);

    if (Math.abs(derivative) < 1e-12) {
      break;
    }

    const nextRate = rate - value / derivative;

    if (Math.abs(nextRate - rate) <= tolerance) {
      return nextRate * 100;
    }

    rate = nextRate;
  }

  return rate * 100;
}

export function calculateTimeWeightedReturn(
  transactions: PerformanceTransaction[],
  options: { endingValue?: number } = {},
): number | null {
  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = parseDate(a.date)?.getTime() ?? 0;
    const dateB = parseDate(b.date)?.getTime() ?? 0;

    return dateA - dateB;
  });

  if (sortedTransactions.length === 0 && options.endingValue === undefined) {
    return null;
  }

  let netAssetValue = 0;
  let twrFactor = 1;

  for (const transaction of sortedTransactions) {
    const amount = Number(transaction.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    switch (transaction.type) {
      case "contribution": {
        netAssetValue += amount;
        break;
      }
      case "distribution": {
        netAssetValue -= amount;
        if (netAssetValue < 0) {
          netAssetValue = 0;
        }
        break;
      }
      case "interest": {
        if (netAssetValue > 0) {
          twrFactor *= 1 + amount / netAssetValue;
        }
        netAssetValue += amount;
        break;
      }
      case "fee": {
        if (netAssetValue > 0) {
          const effectiveAmount = Math.min(amount, netAssetValue);
          twrFactor *= 1 - effectiveAmount / netAssetValue;
          netAssetValue -= effectiveAmount;
        }
        break;
      }
      default:
        break;
    }
  }

  const { endingValue } = options;

  if (endingValue !== undefined && Number.isFinite(endingValue) && endingValue >= 0) {
    if (netAssetValue > 0) {
      const ratio = Number(endingValue) / netAssetValue;
      if (ratio > 0) {
        twrFactor *= ratio;
      }
    }
    netAssetValue = Number(endingValue);
  }

  if (twrFactor <= 0) {
    return null;
  }

  return (twrFactor - 1) * 100;
}
