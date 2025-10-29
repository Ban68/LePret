"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineBanner } from "@/components/ui/inline-banner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InvestorCompany = {
  id: string;
  name: string;
  investor_kind?: string | null;
};

type PortfolioResponse = {
  ok: boolean;
  error?: string;
  positions?: PositionPreview[];
  transactions?: TransactionPreview[];
  statements?: StatementPreview[];
};

type PositionPreview = {
  id: string;
  name: string;
  strategy: string | null;
  investedAmount: number;
  currentValue: number;
  currency: string;
  irr: number | null;
  timeWeightedReturn: number | null;
  updatedAt: string | null;
};

type TransactionPreview = {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  date: string | null;
  description: string | null;
  positionId: string | null;
};

type StatementPreview = {
  id: string;
  period: string | null;
  periodLabel: string | null;
  generatedAt: string | null;
  downloadUrl: string | null;
};

type ReplaceFlags = {
  positions: boolean;
  transactions: boolean;
  statements: boolean;
};

type PositionDraft = {
  key: string;
  id?: string;
  name: string;
  strategy: string;
  investedAmount: string;
  currentValue: string;
  currency: string;
  irr: string;
  timeWeightedReturn: string;
};

type TransactionDraft = {
  key: string;
  id?: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  date: string;
  description: string;
  positionId: string;
};

type StatementDraft = {
  key: string;
  id?: string;
  period: string;
  periodLabel: string;
  generatedAt: string;
  downloadUrl: string;
};

type DeletionFlags = {
  positions: string[];
  transactions: string[];
  statements: string[];
};

function createDraftKey() {
  return Math.random().toString(36).slice(2);
}

function toPositionDraft(position: PositionPreview): PositionDraft {
  return {
    key: createDraftKey(),
    id: position.id,
    name: position.name ?? "",
    strategy: position.strategy ?? "",
    investedAmount: position.investedAmount !== null ? String(position.investedAmount) : "",
    currentValue: position.currentValue !== null ? String(position.currentValue) : "",
    currency: position.currency ?? "COP",
    irr: position.irr !== null && position.irr !== undefined ? String(position.irr) : "",
    timeWeightedReturn:
      position.timeWeightedReturn !== null && position.timeWeightedReturn !== undefined
        ? String(position.timeWeightedReturn)
        : "",
  };
}

function toTransactionDraft(transaction: TransactionPreview): TransactionDraft {
  return {
    key: createDraftKey(),
    id: transaction.id,
    type: transaction.type ?? "contribution",
    status: transaction.status ?? "pending",
    amount: transaction.amount !== null ? String(transaction.amount) : "",
    currency: transaction.currency ?? "COP",
    date: transaction.date ? transaction.date.slice(0, 10) : "",
    description: transaction.description ?? "",
    positionId: transaction.positionId ?? "",
  };
}

function toStatementDraft(statement: StatementPreview): StatementDraft {
  return {
    key: createDraftKey(),
    id: statement.id,
    period: statement.period ?? "",
    periodLabel: statement.periodLabel ?? "",
    generatedAt: statement.generatedAt ? statement.generatedAt.slice(0, 10) : "",
    downloadUrl: statement.downloadUrl ?? "",
  };
}

function createEmptyPositionDraft(): PositionDraft {
  return {
    key: createDraftKey(),
    name: "",
    strategy: "",
    investedAmount: "",
    currentValue: "",
    currency: "COP",
    irr: "",
    timeWeightedReturn: "",
  };
}

function createEmptyTransactionDraft(): TransactionDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    key: createDraftKey(),
    type: "contribution",
    status: "settled",
    amount: "",
    currency: "COP",
    date: today,
    description: "",
    positionId: "",
  };
}

function createEmptyStatementDraft(): StatementDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    key: createDraftKey(),
    period: "",
    periodLabel: "",
    generatedAt: today,
    downloadUrl: "",
  };
}

function normalizeNumberInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^0-9,.-]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const [head, ...rest] = cleaned.split(".");
  const normalized = rest.length > 0 ? `${head}.${rest.join("")}` : head;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
}

function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function InvestorDataManager({ companies }: { companies: InvestorCompany[] }) {
  const [selectedOrg, setSelectedOrg] = useState<string>(() => companies[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [portfolio, setPortfolio] = useState<{
    positions: PositionPreview[];
    transactions: TransactionPreview[];
    statements: StatementPreview[];
  } | null>(null);
  const [positions, setPositions] = useState<PositionDraft[]>([]);
  const [transactions, setTransactions] = useState<TransactionDraft[]>([]);
  const [statements, setStatements] = useState<StatementDraft[]>([]);
  const [deletedIds, setDeletedIds] = useState<DeletionFlags>({
    positions: [],
    transactions: [],
    statements: [],
  });
  const [include, setInclude] = useState<{ positions: boolean; transactions: boolean; statements: boolean }>(() => ({
    positions: true,
    transactions: true,
    statements: false,
  }));
  const [replace, setReplace] = useState<ReplaceFlags>({ positions: false, transactions: false, statements: false });
  const [submitting, setSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [manualType, setManualType] = useState<"contribution" | "distribution">("contribution");
  const [manualAmount, setManualAmount] = useState("");
  const [manualCurrency, setManualCurrency] = useState("COP");
  const manualAmountDisplay = useMemo(() => {
    if (!manualAmount) return "";
    const numeric = Number(manualAmount);
    if (!Number.isFinite(numeric)) return manualAmount;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: manualCurrency || "COP",
      minimumFractionDigits: 2,
    }).format(numeric);
  }, [manualAmount, manualCurrency]);
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualStatus, setManualStatus] = useState("settled");
  const [manualDescription, setManualDescription] = useState("");
  const [manualPositionId, setManualPositionId] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const resetManualForm = useCallback(() => {
    setManualType("contribution");
    setManualAmount("");
    setManualCurrency("COP");
    setManualDescription("");
    setManualPositionId("");
    setManualDate(new Date().toISOString().slice(0, 10));
    setManualStatus("settled");
    setManualError(null);
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedOrg) ?? null,
    [companies, selectedOrg],
  );
  const availablePositions = useMemo(() => portfolio?.positions ?? [], [portfolio]);
  const statusOptions = useMemo(
    () => [
      { value: "settled", label: "Liquidado" },
      { value: "pending", label: "Pendiente" },
      { value: "processing", label: "En proceso" },
      { value: "scheduled", label: "Programado" },
      { value: "cancelled", label: "Cancelado" },
    ],
    [],
  );

  const loadPortfolio = useCallback(
    async (orgId: string) => {
      if (!orgId) return;
      setLoading(true);
      setLastError(null);
      try {
        const response = await fetch(`/api/hq/investors/${orgId}/portfolio`, { cache: "no-store" });
        const payload = (await response.json()) as PortfolioResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "No se pudo cargar la información del portafolio.");
        }

        const positions = payload.positions ?? [];
        const transactions = payload.transactions ?? [];
        const statements = payload.statements ?? [];

        setPortfolio({ positions, transactions, statements });
        setPositions(positions.map(toPositionDraft));
        setTransactions(transactions.map(toTransactionDraft));
        setStatements(statements.map(toStatementDraft));
        setDeletedIds({ positions: [], transactions: [], statements: [] });
        setInclude({
          positions: positions.length > 0,
          transactions: transactions.length > 0,
          statements: statements.length > 0,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error inesperado al cargar datos.";
        setLastError(message);
        setPortfolio(null);
      } finally {
        setLoading(false);
      }
    },
    [setPortfolio],
  );

  useEffect(() => {
    if (selectedOrg) {
      void loadPortfolio(selectedOrg);
    }
  }, [selectedOrg, loadPortfolio]);

  useEffect(() => {
    if (!manualPositionId) return;
    if (!availablePositions.some((position) => position.id === manualPositionId)) {
      setManualPositionId("");
    }
  }, [availablePositions, manualPositionId]);

  useEffect(() => {
    resetManualForm();
  }, [selectedOrg, resetManualForm]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!selectedOrg) {
        toast.error("Selecciona una organización de inversionistas.");
        return;
      }

      try {
        const payload: PortfolioPayload = {
          replace,
        };

        const deletions: DeletionFlags = {
          positions: Array.from(new Set(deletedIds.positions)),
          transactions: Array.from(new Set(deletedIds.transactions)),
          statements: Array.from(new Set(deletedIds.statements)),
        };

        if (include.positions) {
          const normalized: PositionInput[] = positions.map((item, index) => {
            const name = item.name.trim();
            if (!name) {
              throw new Error(`La posición #${index + 1} debe tener nombre.`);
            }

            const investedAmount = normalizeNumberInput(item.investedAmount);
            if (investedAmount === null) {
              throw new Error(`La posición #${index + 1} requiere un monto invertido válido.`);
            }

            const currentValue = normalizeNumberInput(item.currentValue);
            if (currentValue === null) {
              throw new Error(`La posición #${index + 1} requiere un valor actual válido.`);
            }

            const irr = normalizeNumberInput(item.irr);
            const twr = normalizeNumberInput(item.timeWeightedReturn);

            return {
              id: item.id,
              name,
              strategy: item.strategy.trim() || null,
              investedAmount,
              currentValue,
              currency: item.currency || "COP",
              irr,
              timeWeightedReturn: twr,
            };
          });

          if (normalized.length > 0) {
            payload.positions = normalized;
          }
        }

        if (include.transactions) {
          const normalized: TransactionInput[] = transactions.map((item, index) => {
            const type = item.type.trim();
            if (!type) {
              throw new Error(`La transacción #${index + 1} debe indicar un tipo.`);
            }

            const amount = normalizeNumberInput(item.amount);
            if (amount === null || amount <= 0) {
              throw new Error(`La transacción #${index + 1} requiere un monto mayor a cero.`);
            }

            return {
              id: item.id,
              type,
              status: item.status.trim() || "pending",
              amount,
              currency: item.currency || "COP",
              date: item.date || null,
              description: item.description.trim() || null,
              positionId: item.positionId.trim() || null,
            };
          });

          if (normalized.length > 0) {
            payload.transactions = normalized;
          }
        }

        if (include.statements) {
          const normalized: StatementInput[] = statements.map((item, index) => {
            if (!item.period.trim() && !item.periodLabel.trim()) {
              throw new Error(`El estado de cuenta #${index + 1} debe tener periodo o etiqueta.`);
            }

            return {
              id: item.id,
              period: item.period.trim() || null,
              periodLabel: item.periodLabel.trim() || null,
              generatedAt: item.generatedAt || null,
              downloadUrl: item.downloadUrl.trim() || null,
            };
          });

          if (normalized.length > 0) {
            payload.statements = normalized;
          }
        }

        if (deletions.positions.length || deletions.transactions.length || deletions.statements.length) {
          payload.delete = {};
          if (deletions.positions.length) payload.delete.positions = deletions.positions;
          if (deletions.transactions.length) payload.delete.transactions = deletions.transactions;
          if (deletions.statements.length) payload.delete.statements = deletions.statements;
        }

        const hasPayload =
          (payload.positions?.length ?? 0) > 0 ||
          (payload.transactions?.length ?? 0) > 0 ||
          (payload.statements?.length ?? 0) > 0;
        const hasReplace =
          Boolean(payload.replace?.positions) ||
          Boolean(payload.replace?.transactions) ||
          Boolean(payload.replace?.statements);
        const hasDeletions =
          (payload.delete?.positions?.length ?? 0) > 0 ||
          (payload.delete?.transactions?.length ?? 0) > 0 ||
          (payload.delete?.statements?.length ?? 0) > 0;

        if (!hasPayload && !hasReplace && !hasDeletions) {
          toast.error("No hay datos para sincronizar. Agrega cambios o marca una opción de reemplazo.");
          return;
        }

        setSubmitting(true);
        const response = await fetch(`/api/hq/investors/${selectedOrg}/portfolio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = (await response.json()) as PortfolioResponse;
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "No se pudo sincronizar la información del portafolio.");
        }

        const updatedPositions = result.positions ?? [];
        const updatedTransactions = result.transactions ?? [];
        const updatedStatements = result.statements ?? [];

        setPortfolio({ positions: updatedPositions, transactions: updatedTransactions, statements: updatedStatements });
        setPositions(updatedPositions.map(toPositionDraft));
        setTransactions(updatedTransactions.map(toTransactionDraft));
        setStatements(updatedStatements.map(toStatementDraft));
        setDeletedIds({ positions: [], transactions: [], statements: [] });
        setInclude({
          positions: updatedPositions.length > 0,
          transactions: updatedTransactions.length > 0,
          statements: updatedStatements.length > 0,
        });
        toast.success("Portafolio actualizado correctamente.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error inesperado al sincronizar.";
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [include, positions, transactions, statements, selectedOrg, replace, deletedIds],
  );


  const handleManualMovement = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedOrg) {
        toast.error("Selecciona una organizacion de inversionistas.");
        return;
      }

      const numericAmount = Number(manualAmount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        const message = "Ingresa un monto valido (mayor a cero).";
        setManualError(message);
        toast.error(message);
        return;
      }

      setManualBusy(true);
      setManualError(null);

      try {
        const response = await fetch(`/api/hq/investors/${selectedOrg}/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: manualType,
            amount: manualAmount,
            currency: manualCurrency,
            date: manualDate,
            description: manualDescription,
            positionId: manualPositionId || null,
            status: manualStatus,
          }),
        });
        const result = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "No se pudo registrar el movimiento.");
        }

        toast.success("Movimiento registrado correctamente.");
        resetManualForm();
        await loadPortfolio(selectedOrg);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error inesperado al registrar el movimiento.";
        setManualError(message);
        toast.error(message);
      } finally {
        setManualBusy(false);
      }
    },
    [
      selectedOrg,
      manualAmount,
      manualCurrency,
      manualDate,
      manualDescription,
      manualPositionId,
      manualStatus,
      manualType,
      loadPortfolio,
      resetManualForm,
    ],
  );

  const upsertDeletedId = useCallback((category: keyof DeletionFlags, id: string) => {
    setDeletedIds((prev) => {
      if (!id) return prev;
      const list = prev[category];
      if (list.includes(id)) return prev;
      return {
        ...prev,
        [category]: [...list, id],
      };
    });
  }, []);

  const handleAddPosition = useCallback(() => {
    setPositions((prev) => [...prev, createEmptyPositionDraft()]);
    setInclude((prev) => ({ ...prev, positions: true }));
  }, []);

  const handleUpdatePosition = useCallback((key: string, patch: Partial<PositionDraft>) => {
    setPositions((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }, []);

  const handleRemovePosition = useCallback(
    (key: string) => {
      setPositions((prev) => {
        const target = prev.find((item) => item.key === key);
        if (target?.id) {
          upsertDeletedId("positions", target.id);
        }
        return prev.filter((item) => item.key !== key);
      });
    },
    [upsertDeletedId],
  );

  const handleAddTransaction = useCallback(() => {
    setTransactions((prev) => [...prev, createEmptyTransactionDraft()]);
    setInclude((prev) => ({ ...prev, transactions: true }));
  }, []);

  const handleUpdateTransaction = useCallback((key: string, patch: Partial<TransactionDraft>) => {
    setTransactions((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }, []);

  const handleRemoveTransaction = useCallback(
    (key: string) => {
      setTransactions((prev) => {
        const target = prev.find((item) => item.key === key);
        if (target?.id) {
          upsertDeletedId("transactions", target.id);
        }
        return prev.filter((item) => item.key !== key);
      });
    },
    [upsertDeletedId],
  );

  const handleAddStatement = useCallback(() => {
    setStatements((prev) => [...prev, createEmptyStatementDraft()]);
    setInclude((prev) => ({ ...prev, statements: true }));
  }, []);

  const handleUpdateStatement = useCallback((key: string, patch: Partial<StatementDraft>) => {
    setStatements((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }, []);

  const handleRemoveStatement = useCallback(
    (key: string) => {
      setStatements((prev) => {
        const target = prev.find((item) => item.key === key);
        if (target?.id) {
          upsertDeletedId("statements", target.id);
        }
        return prev.filter((item) => item.key !== key);
      });
    },
    [upsertDeletedId],
  );

  if (companies.length === 0) {
    return (
      <InlineBanner
        tone="warning"
        title="No hay organizaciones de inversionistas"
        description="Registra al menos un inversor en la sección de Usuarios antes de cargar portafolios."
      />
    );
  }

  const renderSummary = () => {
    if (!portfolio) return null;

    return (
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-lp-sec-5/40 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-lp-sec-4">Posiciones</p>
          <p className="mt-1 text-2xl font-semibold text-lp-primary-1">{portfolio.positions.length}</p>
          <ul className="mt-2 space-y-1 text-xs text-lp-sec-3">
            {portfolio.positions.slice(0, 4).map((position) => (
              <li key={position.id} className="flex justify-between gap-2">
                <span className="truncate">{position.name}</span>
                <span>{formatNumber(position.currentValue)} {position.currency}</span>
              </li>
            ))}
            {portfolio.positions.length > 4 ? (
              <li className="text-xs italic text-lp-sec-4">+ {portfolio.positions.length - 4} adicionales</li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-lg border border-lp-sec-5/40 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-lp-sec-4">Transacciones registradas</p>
          <p className="mt-1 text-2xl font-semibold text-lp-primary-1">{portfolio.transactions.length}</p>
          <ul className="mt-2 space-y-1 text-xs text-lp-sec-3">
            {portfolio.transactions.slice(0, 4).map((transaction) => (
              <li key={transaction.id} className="flex justify-between gap-2">
                <span className="truncate">
                  {transaction.type} ({transaction.status})
                </span>
                <span>{formatNumber(transaction.amount)} {transaction.currency}</span>
              </li>
            ))}
            {portfolio.transactions.length > 4 ? (
              <li className="text-xs italic text-lp-sec-4">+ {portfolio.transactions.length - 4} adicionales</li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-lg border border-lp-sec-5/40 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-lp-sec-4">Estados de cuenta</p>
          <p className="mt-1 text-2xl font-semibold text-lp-primary-1">{portfolio.statements.length}</p>
          <ul className="mt-2 space-y-1 text-xs text-lp-sec-3">
            {portfolio.statements.slice(0, 4).map((statement) => (
              <li key={statement.id} className="flex justify-between gap-2">
                <span className="truncate">
                  {statement.periodLabel || statement.period || "Sin periodo"}
                </span>
                <span>{formatDate(statement.generatedAt)}</span>
              </li>
            ))}
            {portfolio.statements.length > 4 ? (
              <li className="text-xs italic text-lp-sec-4">+ {portfolio.statements.length - 4} adicionales</li>
            ) : null}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-lp-sec-5/40 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-lp-primary-1">Sincronización de portafolios</h2>
            <p className="text-sm text-lp-sec-3">
              Selecciona una organización de inversionistas para consultar o reemplazar sus posiciones, transacciones y estados de cuenta.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:w-80">
            <Label htmlFor="investor-org">Organización</Label>
            <select
              id="investor-org"
              className="rounded-md border border-lp-sec-4/60 px-3 py-2 text-sm"
              value={selectedOrg}
              onChange={(event) => setSelectedOrg(event.target.value)}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                  {company.investor_kind ? ` · ${company.investor_kind}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={() => selectedOrg && loadPortfolio(selectedOrg)} disabled={loading}>
            {loading ? "Actualizando..." : "Refrescar datos"}
          </Button>
          {selectedCompany?.investor_kind ? (
            <span className="text-xs uppercase tracking-wide text-lp-sec-4">
              Tipo: {selectedCompany.investor_kind}
            </span>
          ) : null}
        </div>

        {lastError ? (
          <div className="mt-4">
            <InlineBanner tone="error" title="No se pudo cargar el portafolio" description={lastError} />
          </div>
        ) : null}

        <div className="mt-6">{renderSummary()}</div>
      </section>

      <form className="space-y-4" onSubmit={handleManualMovement}>
        <Card className="border-lp-sec-5/40">
          <CardHeader>
            <CardTitle>Movimientos manuales</CardTitle>
            <CardDescription>
              Registra adiciones (aportes) o retiros sin necesidad de editar el JSON completo. Los movimientos se guardan como transacciones tipo contribution o distribution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {manualError ? (
              <InlineBanner
                tone="error"
                title="No se pudo registrar el movimiento"
                description={manualError}
              />
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manual-type">Tipo de movimiento</Label>
                <select
                  id="manual-type"
                  className="rounded-md border border-lp-sec-4/60 px-3 py-2 text-sm"
                  value={manualType}
                  onChange={(event) => {
                    setManualType(event.target.value as "contribution" | "distribution");
                    setManualError(null);
                  }}
                  disabled={manualBusy}
                >
                  <option value="contribution">Adicion (aporte)</option>
                  <option value="distribution">Retiro</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-amount">Monto</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-lp-sec-4">
                    $
                  </span>
                  <Input
                    id="manual-amount"
                    type="text"
                    inputMode="decimal"
                    className="pl-7"
                    value={manualAmount}
                    onChange={(event) => {
                      const cleaned = event.target.value.replace(/[^\d.,]/g, "");
                      const withDot = cleaned.replace(",", ".");
                      const [head, ...rest] = withDot.split(".");
                      const normalized =
                        rest.length > 0 ? `${head}.${rest.join("")}` : head;
                      setManualAmount(normalized);
                      if (manualError) setManualError(null);
                    }}
                    disabled={manualBusy}
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-lp-sec-4">
                  {manualAmount ? manualAmountDisplay : "Ingresa el valor en la moneda seleccionada."}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-currency">Moneda</Label>
                <select
                  id="manual-currency"
                  className="rounded-md border border-lp-sec-4/60 px-3 py-2 text-sm"
                  value={manualCurrency}
                  onChange={(event) => setManualCurrency(event.target.value)}
                  disabled={manualBusy}
                >
                  <option value="COP">COP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-date">Fecha del movimiento</Label>
                <Input
                  id="manual-date"
                  type="date"
                  value={manualDate}
                  onChange={(event) => setManualDate(event.target.value)}
                  disabled={manualBusy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-status">Estado</Label>
                <select
                  id="manual-status"
                  className="rounded-md border border-lp-sec-4/60 px-3 py-2 text-sm"
                  value={manualStatus}
                  onChange={(event) => setManualStatus(event.target.value)}
                  disabled={manualBusy}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-lp-sec-4">
                  Por defecto registramos los movimientos como liquidados. Ajusta el estado si aun esta en proceso.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-position">Asociar a posicion</Label>
                <select
                  id="manual-position"
                  className="rounded-md border border-lp-sec-4/60 px-3 py-2 text-sm"
                  value={manualPositionId}
                  onChange={(event) => setManualPositionId(event.target.value)}
                  disabled={manualBusy || availablePositions.length === 0}
                >
                  <option value="">Sin posicion (general)</option>
                  {availablePositions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-lp-sec-4">
                  Si no seleccionas una posicion, el movimiento se asociara al portafolio general del inversionista.
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="manual-description">Descripcion</Label>
                <Textarea
                  id="manual-description"
                  rows={3}
                  value={manualDescription}
                  onChange={(event) => setManualDescription(event.target.value)}
                  disabled={manualBusy}
                  placeholder="Detalle opcional del movimiento"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-end gap-3">
            <Button type="button" variant="ghost" disabled={manualBusy} onClick={resetManualForm}>
              Limpiar campos
            </Button>
            <Button
              type="submit"
              className="bg-lp-primary-1 text-white hover:bg-lp-primary-1/90"
              disabled={manualBusy}
            >
              {manualBusy ? "Registrando..." : "Registrar movimiento"}
            </Button>
          </CardFooter>
        </Card>
      </form>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <Card className="border-lp-sec-5/40">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Posiciones</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-lp-sec-3">
                  <Checkbox
                    checked={include.positions}
                    onCheckedChange={(value) =>
                      setInclude((prev) => ({ ...prev, positions: Boolean(value) }))
                    }
                  />
                  Incluir en la sincronización
                </label>
                <label className={cn("flex items-center gap-2 text-xs", replace.positions ? "text-red-600" : "text-lp-sec-3")}>
                  <Checkbox
                    checked={replace.positions}
                    onCheckedChange={(value) =>
                      setReplace((prev) => ({ ...prev, positions: Boolean(value) }))
                    }
                  />
                  Reemplazar todas las posiciones previas
                </label>
              </div>
            </CardTitle>
            <CardDescription>
              Define las posiciones actuales del inversionista (nombre, estrategia, montos). Puedes dejar el campo vacío si no deseas enviar cambios.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {positions.length === 0 ? (
              <p className="text-sm text-lp-sec-4">
                No hay posiciones registradas. Agrega una nueva posición para sincronizarla con el portafolio.
              </p>
            ) : null}
            {positions.map((position, index) => (
              <div
                key={position.key}
                className="space-y-4 rounded-md border border-lp-sec-5/60 bg-lp-sec-6/5 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-lp-primary-1">Posición #{index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemovePosition(position.key)}
                    disabled={submitting}
                  >
                    Eliminar
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`position-name-${position.key}`}>Nombre</Label>
                    <Input
                      id={`position-name-${position.key}`}
                      value={position.name}
                      onChange={(event) =>
                        handleUpdatePosition(position.key, { name: event.target.value })
                      }
                      disabled={submitting}
                      placeholder="Ej. Factoring mensual"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`position-strategy-${position.key}`}>Estrategia</Label>
                    <Input
                      id={`position-strategy-${position.key}`}
                      value={position.strategy}
                      onChange={(event) =>
                        handleUpdatePosition(position.key, { strategy: event.target.value })
                      }
                      disabled={submitting}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor={`position-invested-${position.key}`}>Monto invertido</Label>
                    <Input
                      id={`position-invested-${position.key}`}
                      inputMode="decimal"
                      value={position.investedAmount}
                      onChange={(event) =>
                        handleUpdatePosition(position.key, { investedAmount: event.target.value })
                      }
                      disabled={submitting}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`position-value-${position.key}`}>Valor actual</Label>
                    <Input
                      id={`position-value-${position.key}`}
                      inputMode="decimal"
                      value={position.currentValue}
                      onChange={(event) =>
                        handleUpdatePosition(position.key, { currentValue: event.target.value })
                      }
                      disabled={submitting}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`position-currency-${position.key}`}>Moneda</Label>
                    <select
                      id={`position-currency-${position.key}`}
                      className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2 text-sm"
                      value={position.currency}
                      onChange={(event) =>
                        handleUpdatePosition(position.key, { currency: event.target.value })
                      }
                      disabled={submitting}
                    >
                      <option value="COP">COP</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`position-irr-${position.key}`}>IRR (%)</Label>
                    <Input
                      id={`position-irr-${position.key}`}
                      inputMode="decimal"
                      value={position.irr}
                      onChange={(event) =>
                        handleUpdatePosition(position.key, { irr: event.target.value })
                      }
                      disabled={submitting}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`position-twr-${position.key}`}>TWR (%)</Label>
                    <Input
                      id={`position-twr-${position.key}`}
                      inputMode="decimal"
                      value={position.timeWeightedReturn}
                      onChange={(event) =>
                        handleUpdatePosition(position.key, { timeWeightedReturn: event.target.value })
                      }
                      disabled={submitting}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              </div>
            ))}
            {deletedIds.positions.length > 0 ? (
              <p className="text-xs text-red-600">
                Se eliminarán {deletedIds.positions.length} posición(es) al sincronizar.
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddPosition}
              disabled={submitting}
            >
              Agregar posición
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-lp-sec-5/40">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Transacciones</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-lp-sec-3">
                  <Checkbox
                    checked={include.transactions}
                    onCheckedChange={(value) =>
                      setInclude((prev) => ({ ...prev, transactions: Boolean(value) }))
                    }
                  />
                  Incluir en la sincronización
                </label>
                <label className={cn("flex items-center gap-2 text-xs", replace.transactions ? "text-red-600" : "text-lp-sec-3")}>
                  <Checkbox
                    checked={replace.transactions}
                    onCheckedChange={(value) =>
                      setReplace((prev) => ({ ...prev, transactions: Boolean(value) }))
                    }
                  />
                  Borrar transacciones previas
                </label>
              </div>
            </CardTitle>
            <CardDescription>
              Registra aportes, retiros, intereses u honorarios. Los tipos válidos son <code className="font-mono">contribution</code>, <code className="font-mono">distribution</code>, <code className="font-mono">interest</code> y <code className="font-mono">fee</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {transactions.length === 0 ? (
              <p className="text-sm text-lp-sec-4">
                No hay transacciones seleccionadas para sincronizar. Agrega una nueva o usa el formulario de movimientos manuales.
              </p>
            ) : null}
            {transactions.map((transaction, index) => (
              <div
                key={transaction.key}
                className="space-y-4 rounded-md border border-lp-sec-5/60 bg-lp-sec-6/5 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-lp-primary-1">Transacción #{index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveTransaction(transaction.key)}
                    disabled={submitting}
                  >
                    Eliminar
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor={`transaction-type-${transaction.key}`}>Tipo</Label>
                    <select
                      id={`transaction-type-${transaction.key}`}
                      className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2 text-sm"
                      value={transaction.type}
                      onChange={(event) =>
                        handleUpdateTransaction(transaction.key, { type: event.target.value })
                      }
                      disabled={submitting}
                    >
                      <option value="contribution">Aporte</option>
                      <option value="distribution">Retiro</option>
                      <option value="interest">Interés</option>
                      <option value="fee">Fee</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`transaction-status-${transaction.key}`}>Estado</Label>
                    <select
                      id={`transaction-status-${transaction.key}`}
                      className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2 text-sm"
                      value={transaction.status}
                      onChange={(event) =>
                        handleUpdateTransaction(transaction.key, { status: event.target.value })
                      }
                      disabled={submitting}
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`transaction-date-${transaction.key}`}>Fecha</Label>
                    <Input
                      id={`transaction-date-${transaction.key}`}
                      type="date"
                      value={transaction.date}
                      onChange={(event) =>
                        handleUpdateTransaction(transaction.key, { date: event.target.value })
                      }
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor={`transaction-amount-${transaction.key}`}>Monto</Label>
                    <Input
                      id={`transaction-amount-${transaction.key}`}
                      inputMode="decimal"
                      value={transaction.amount}
                      onChange={(event) =>
                        handleUpdateTransaction(transaction.key, { amount: event.target.value })
                      }
                      disabled={submitting}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`transaction-currency-${transaction.key}`}>Moneda</Label>
                    <select
                      id={`transaction-currency-${transaction.key}`}
                      className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2 text-sm"
                      value={transaction.currency}
                      onChange={(event) =>
                        handleUpdateTransaction(transaction.key, { currency: event.target.value })
                      }
                      disabled={submitting}
                    >
                      <option value="COP">COP</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`transaction-position-${transaction.key}`}>Asociar posición</Label>
                    <select
                      id={`transaction-position-${transaction.key}`}
                      className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2 text-sm"
                      value={transaction.positionId}
                      onChange={(event) =>
                        handleUpdateTransaction(transaction.key, { positionId: event.target.value })
                      }
                      disabled={submitting || availablePositions.length === 0}
                    >
                      <option value="">Portafolio general</option>
                      {availablePositions.map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`transaction-description-${transaction.key}`}>Descripción</Label>
                  <Textarea
                    id={`transaction-description-${transaction.key}`}
                    rows={2}
                    value={transaction.description}
                    onChange={(event) =>
                      handleUpdateTransaction(transaction.key, { description: event.target.value })
                    }
                    disabled={submitting}
                    placeholder="Detalle opcional"
                  />
                </div>
              </div>
            ))}
            {deletedIds.transactions.length > 0 ? (
              <p className="text-xs text-red-600">
                Se eliminarán {deletedIds.transactions.length} transacción(es) al sincronizar.
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddTransaction}
              disabled={submitting}
            >
              Agregar transacción
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-lp-sec-5/40">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Estados de cuenta</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-lp-sec-3">
                  <Checkbox
                    checked={include.statements}
                    onCheckedChange={(value) =>
                      setInclude((prev) => ({ ...prev, statements: Boolean(value) }))
                    }
                  />
                  Incluir en la sincronización
                </label>
                <label className={cn("flex items-center gap-2 text-xs", replace.statements ? "text-red-600" : "text-lp-sec-3")}>
                  <Checkbox
                    checked={replace.statements}
                    onCheckedChange={(value) =>
                      setReplace((prev) => ({ ...prev, statements: Boolean(value) }))
                    }
                  />
                  Reemplazar estados anteriores
                </label>
              </div>
            </CardTitle>
            <CardDescription>
              Control de reportes para inversionistas. Puedes incluir <code className="font-mono">downloadUrl</code> para enlazar al documento firmado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {statements.length === 0 ? (
              <p className="text-sm text-lp-sec-4">
                No hay estados de cuenta listos para sincronizar. Agrega un registro para compartirlo con el inversionista.
              </p>
            ) : null}
            {statements.map((statement, index) => (
              <div
                key={statement.key}
                className="space-y-4 rounded-md border border-lp-sec-5/60 bg-lp-sec-6/5 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-lp-primary-1">Estado #{index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveStatement(statement.key)}
                    disabled={submitting}
                  >
                    Eliminar
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`statement-period-${statement.key}`}>Periodo</Label>
                    <Input
                      id={`statement-period-${statement.key}`}
                      value={statement.period}
                      onChange={(event) =>
                        handleUpdateStatement(statement.key, { period: event.target.value })
                      }
                      disabled={submitting}
                      placeholder="Ej. 2024-Q1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`statement-periodLabel-${statement.key}`}>Etiqueta visible</Label>
                    <Input
                      id={`statement-periodLabel-${statement.key}`}
                      value={statement.periodLabel}
                      onChange={(event) =>
                        handleUpdateStatement(statement.key, { periodLabel: event.target.value })
                      }
                      disabled={submitting}
                      placeholder="Ej. Primer trimestre 2024"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`statement-date-${statement.key}`}>Fecha de emisión</Label>
                    <Input
                      id={`statement-date-${statement.key}`}
                      type="date"
                      value={statement.generatedAt}
                      onChange={(event) =>
                        handleUpdateStatement(statement.key, { generatedAt: event.target.value })
                      }
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`statement-url-${statement.key}`}>Enlace de descarga</Label>
                    <Input
                      id={`statement-url-${statement.key}`}
                      value={statement.downloadUrl}
                      onChange={(event) =>
                        handleUpdateStatement(statement.key, { downloadUrl: event.target.value })
                      }
                      disabled={submitting}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
            ))}
            {deletedIds.statements.length > 0 ? (
              <p className="text-xs text-red-600">
                Se eliminarán {deletedIds.statements.length} estado(s) de cuenta al sincronizar.
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddStatement}
              disabled={submitting}
            >
              Agregar estado de cuenta
            </Button>
          </CardFooter>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="ghost" disabled={submitting} onClick={() => selectedOrg && loadPortfolio(selectedOrg)}>
            Volver a cargar
          </Button>
          <Button type="submit" className="bg-lp-primary-1 text-white hover:bg-lp-primary-1/90" disabled={submitting}>
            {submitting ? "Sincronizando..." : "Sincronizar portafolio"}
          </Button>
        </div>
      </form>
    </div>
  );
}

type PositionInput = PositionPreview & { id?: string };
type TransactionInput = TransactionPreview & { id?: string };
type StatementInput = StatementPreview & { id?: string };
type PortfolioPayload = {
  positions?: PositionInput[];
  transactions?: TransactionInput[];
  statements?: StatementInput[];
  replace?: ReplaceFlags;
  delete?: Partial<DeletionFlags>;
};











