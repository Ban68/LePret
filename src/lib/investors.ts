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
  irr: number;
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

const defaultSummary: InvestorSummary = {
  investedCapital: 350_000_000,
  cumulativeReturn: {
    value: 42_500_000,
    percentage: 12.1,
  },
  upcomingCashflows: [
    {
      id: "cf-1",
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      amount: 12_500_000,
      currency: "COP",
      description: "Distribución trimestral Fondo Principal",
    },
    {
      id: "cf-2",
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20).toISOString(),
      amount: 8_250_000,
      currency: "COP",
      description: "Retorno parcial Operación Crédito Pymes",
    },
    {
      id: "cf-3",
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString(),
      amount: 5_000_000,
      currency: "COP",
      description: "Vencimiento pagaré Agroindustrial",
    },
  ],
  currency: "COP",
};

const defaultPositions: InvestorPosition[] = [
  {
    id: "pos-1",
    name: "Fondo de Factoring Regional",
    strategy: "Factoring",
    investedAmount: 120_000_000,
    currentValue: 128_500_000,
    currency: "COP",
    irr: 9.8,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "pos-2",
    name: "Línea Crédito Pymes",
    strategy: "Crédito",
    investedAmount: 90_000_000,
    currentValue: 94_250_000,
    currency: "COP",
    irr: 7.4,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "pos-3",
    name: "Programa Agroindustrial",
    strategy: "Supply Chain",
    investedAmount: 140_000_000,
    currentValue: 144_700_000,
    currency: "COP",
    irr: 10.2,
    updatedAt: new Date().toISOString(),
  },
];

const defaultTransactions: InvestorTransaction[] = [
  {
    id: "tx-1",
    type: "contribution",
    amount: 50_000_000,
    currency: "COP",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
    description: "Aporte inicial Fondo de Factoring",
    positionId: "pos-1",
  },
  {
    id: "tx-2",
    type: "interest",
    amount: 4_750_000,
    currency: "COP",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    description: "Intereses mensuales Línea Crédito Pymes",
    positionId: "pos-2",
  },
  {
    id: "tx-3",
    type: "distribution",
    amount: 6_200_000,
    currency: "COP",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    description: "Distribución parcial Programa Agroindustrial",
    positionId: "pos-3",
  },
];

const defaultStatements: InvestorStatement[] = [
  {
    id: "st-1",
    period: "2024-Q1",
    generatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    downloadUrl: "#",
  },
  {
    id: "st-2",
    period: "2024-Q2",
    generatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    downloadUrl: "#",
  },
];

function withOrgFallback<T>(collection: Record<string, T[] | T>, orgId: string, fallback: T[] | T): T[] | T {
  return collection[orgId] ?? fallback;
}

const summaryByOrg: Record<string, InvestorSummary> = {};
const positionsByOrg: Record<string, InvestorPosition[]> = {};
const transactionsByOrg: Record<string, InvestorTransaction[]> = {};
const statementsByOrg: Record<string, InvestorStatement[]> = {};

export async function getInvestorSummary(orgId: string): Promise<InvestorSummary> {
  return withOrgFallback(summaryByOrg, orgId, defaultSummary) as InvestorSummary;
}

export async function getInvestorPositions(orgId: string): Promise<InvestorPosition[]> {
  return withOrgFallback(positionsByOrg, orgId, defaultPositions) as InvestorPosition[];
}

export async function getInvestorTransactions(orgId: string): Promise<InvestorTransaction[]> {
  return withOrgFallback(transactionsByOrg, orgId, defaultTransactions) as InvestorTransaction[];
}

export async function getInvestorStatements(orgId: string): Promise<InvestorStatement[]> {
  return withOrgFallback(statementsByOrg, orgId, defaultStatements) as InvestorStatement[];
}
