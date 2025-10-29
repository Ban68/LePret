"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineBanner } from "@/components/ui/inline-banner";
import { Label } from "@/components/ui/label";
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

const EMPTY_JSON = "[]";

function stringify(data: unknown): string {
  try {
    return JSON.stringify(data ?? [], null, 2);
  } catch {
    return EMPTY_JSON;
  }
}

function isMeaningful(text: string): boolean {
  return text.trim().length > 0;
}

function parseArrayFromTextarea(value: string, label: string): unknown[] | undefined {
  if (!isMeaningful(value)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error(`El campo ${label} debe ser un arreglo JSON (por ejemplo []).`);
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "JSON inválido";
    throw new Error(`Error al procesar ${label}: ${message}`);
  }
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
  const [positionsJson, setPositionsJson] = useState(EMPTY_JSON);
  const [transactionsJson, setTransactionsJson] = useState(EMPTY_JSON);
  const [statementsJson, setStatementsJson] = useState(EMPTY_JSON);
  const [include, setInclude] = useState<{ positions: boolean; transactions: boolean; statements: boolean }>(() => ({
    positions: true,
    transactions: true,
    statements: false,
  }));
  const [replace, setReplace] = useState<ReplaceFlags>({ positions: false, transactions: false, statements: false });
  const [submitting, setSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedOrg) ?? null,
    [companies, selectedOrg],
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
        setPositionsJson(stringify(positions));
        setTransactionsJson(stringify(transactions));
        setStatementsJson(stringify(statements));
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

        if (include.positions) {
          const parsed = parseArrayFromTextarea(positionsJson, "posiciones");
          if (parsed) payload.positions = parsed as PositionInput[];
        }

        if (include.transactions) {
          const parsed = parseArrayFromTextarea(transactionsJson, "transacciones");
          if (parsed) payload.transactions = parsed as TransactionInput[];
        }

        if (include.statements) {
          const parsed = parseArrayFromTextarea(statementsJson, "estados de cuenta");
          if (parsed) payload.statements = parsed as StatementInput[];
        }

        if (
          !payload.positions?.length &&
          !payload.transactions?.length &&
          !payload.statements?.length &&
          !payload.replace?.positions &&
          !payload.replace?.transactions &&
          !payload.replace?.statements
        ) {
          toast.error("No hay datos para sincronizar. Incluye al menos un bloque o marca reemplazo.");
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

        const positions = result.positions ?? [];
        const transactions = result.transactions ?? [];
        const statements = result.statements ?? [];

        setPortfolio({ positions, transactions, statements });
        setPositionsJson(stringify(positions));
        setTransactionsJson(stringify(transactions));
        setStatementsJson(stringify(statements));
        setInclude({
          positions: positions.length > 0,
          transactions: transactions.length > 0,
          statements: statements.length > 0,
        });
        toast.success("Portafolio actualizado correctamente.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error inesperado al sincronizar.";
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [include, positionsJson, transactionsJson, statementsJson, selectedOrg, replace],
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
          <CardContent>
            <Textarea
              className="h-64 font-mono text-xs"
              value={positionsJson}
              onChange={(event) => setPositionsJson(event.target.value)}
              disabled={submitting}
            />
            <p className="mt-2 text-xs text-lp-sec-4">
              Cada objeto debe incluir al menos <code className="font-mono">name</code>, <code className="font-mono">investedAmount</code> y <code className="font-mono">currentValue</code>.
              Si proporcionas <code className="font-mono">id</code>, actualizaremos la posición existente; de lo contrario, se generará un identificador nuevo.
            </p>
          </CardContent>
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
          <CardContent>
            <Textarea
              className="h-64 font-mono text-xs"
              value={transactionsJson}
              onChange={(event) => setTransactionsJson(event.target.value)}
              disabled={submitting}
            />
            <p className="mt-2 text-xs text-lp-sec-4">
              Incluye <code className="font-mono">amount</code>, <code className="font-mono">type</code> y opcionalmente <code className="font-mono">date</code>, <code className="font-mono">description</code> y <code className="font-mono">positionId</code>.
              El estado por defecto es <code className="font-mono">pending</code>; puedes usar <code className="font-mono">processing</code>, <code className="font-mono">settled</code>, <code className="font-mono">cancelled</code> o <code className="font-mono">scheduled</code>.
            </p>
          </CardContent>
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
          <CardContent>
            <Textarea
              className="h-48 font-mono text-xs"
              value={statementsJson}
              onChange={(event) => setStatementsJson(event.target.value)}
              disabled={submitting}
            />
            <p className="mt-2 text-xs text-lp-sec-4">
              Provee <code className="font-mono">period</code>, <code className="font-mono">periodLabel</code>, <code className="font-mono">generatedAt</code> y <code className="font-mono">downloadUrl</code>. Si dejas el bloque vacío, no se enviarán cambios.
            </p>
          </CardContent>
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
};
