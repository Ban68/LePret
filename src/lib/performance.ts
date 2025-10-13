import type { InvestorTransaction } from "./investors";

const INVESTOR_OUTFLOW_TYPES = new Set<InvestorTransaction["type"]>([
  "contribution",
  "fee",
]);

const INVESTOR_INFLOW_TYPES = new Set<InvestorTransaction["type"]>([
  "distribution",
  "interest",
]);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface ValuationInput {
  valuationDate?: string | Date;
  valuationAmount?: number;
  beginningValue?: number;
}

interface Cashflow {
  amount: number;
  date: Date;
}

function toDate(value: string | Date | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getInvestorCashflows(transactions: InvestorTransaction[]): Cashflow[] {
  return transactions
    .map((transaction) => {
      const date = toDate(transaction.date);
      if (!date) {
        return null;
      }

      const sign = INVESTOR_OUTFLOW_TYPES.has(transaction.type) ? -1 : 1;

      return {
        amount: sign * Math.abs(transaction.amount),
        date,
      };
    })
    .filter((cashflow): cashflow is Cashflow => cashflow !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getPortfolioCashflows(transactions: InvestorTransaction[]): Cashflow[] {
  return transactions
    .map((transaction) => {
      const date = toDate(transaction.date);
      if (!date) {
        return null;
      }

      let amount = Math.abs(transaction.amount);
      if (INVESTOR_INFLOW_TYPES.has(transaction.type)) {
        amount *= -1;
      }

      return {
        amount,
        date,
      };
    })
    .filter((cashflow): cashflow is Cashflow => cashflow !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function xnpv(rate: number, cashflows: Cashflow[]): number {
  if (cashflows.length === 0) {
    return 0;
  }

  const firstDate = cashflows[0].date.getTime();

  return cashflows.reduce((total, cashflow) => {
    const t = (cashflow.date.getTime() - firstDate) / MS_PER_DAY / 365;
    return total + cashflow.amount / Math.pow(1 + rate, t);
  }, 0);
}

function secantIRR(cashflows: Cashflow[], maxIterations = 100, tolerance = 1e-6): number | null {
  let rate0 = 0;
  let rate1 = 0.1;
  let npv0 = xnpv(rate0, cashflows);
  let npv1 = xnpv(rate1, cashflows);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (Math.abs(npv1) < tolerance) {
      return rate1;
    }

    const denominator = npv1 - npv0;
    if (Math.abs(denominator) < tolerance) {
      break;
    }

    const rate2 = rate1 - npv1 * (rate1 - rate0) / denominator;
    const boundedRate = Math.max(rate2, -0.999999);

    rate0 = rate1;
    npv0 = npv1;
    rate1 = boundedRate;
    npv1 = xnpv(rate1, cashflows);
  }

  return null;
}

export function calculateIRR(
  transactions: InvestorTransaction[],
  valuation: ValuationInput = {},
): number | null {
  const cashflows = getInvestorCashflows(transactions);

  const valuationDate = toDate(valuation.valuationDate);
  const valuationAmount = valuation.valuationAmount ?? 0;

  if (valuationDate && valuationAmount !== 0) {
    cashflows.push({
      amount: valuationAmount,
      date: valuationDate,
    });
  }

  const hasPositive = cashflows.some((flow) => flow.amount > 0);
  const hasNegative = cashflows.some((flow) => flow.amount < 0);

  if (!hasPositive || !hasNegative) {
    return null;
  }

  const irr = secantIRR(cashflows);

  return irr ?? null;
}

export function calculateTWR(
  transactions: InvestorTransaction[],
  valuation: ValuationInput = {},
): number | null {
  const cashflows = getPortfolioCashflows(transactions);
  const valuationDate = toDate(valuation.valuationDate);
  const endDate = valuationDate ?? cashflows[cashflows.length - 1]?.date ?? null;
  const endValue = valuation.valuationAmount ?? 0;
  const beginningValue = valuation.beginningValue ?? 0;

  if (!endDate) {
    return null;
  }

  const startDate = cashflows[0]?.date ?? endDate;
  const totalDays = Math.max((endDate.getTime() - startDate.getTime()) / MS_PER_DAY, 0);

  const totalFlows = cashflows.reduce((total, flow) => total + flow.amount, 0);

  const weightedFlows = cashflows.reduce((total, flow) => {
    if (totalDays === 0) {
      return total;
    }

    const daysRemaining = (endDate.getTime() - flow.date.getTime()) / MS_PER_DAY;
    const weight = Math.max(Math.min(daysRemaining / totalDays, 1), 0);

    return total + flow.amount * weight;
  }, 0);

  const denominator = beginningValue + weightedFlows;

  if (denominator === 0) {
    return null;
  }

  const numerator = endValue - beginningValue - totalFlows;

  return numerator / denominator;
}
