"use client";

import { useCallback, useEffect, useState } from "react";

export type StageDurations = Record<string, { averageHours: number; samples: number }>;

export type FeedbackMetrics = {
  nps: { average: number | null; responses: number };
  csat: { average: number | null; responses: number };
};

export type HqMetrics = {
  totalRequests: number;
  totalAmount: number;
  requestsByStatus: Record<string, number>;
  requestsByMonth: Record<string, number>;
  approvalRate?: number;
  stageDurations?: StageDurations;
  validationErrors30d?: number;
  feedback?: FeedbackMetrics;
  fundedAmount?: number;
  fundedRequests?: number;
  averageDisbursementHours?: number | null;
  averageApprovalHours?: number | null;
  averageYieldPct?: number | null;
  averageAdvancePct?: number | null;
  monthlyFundingVolumes?: Record<string, number>;
};

export function useHqMetrics() {
  const [metrics, setMetrics] = useState<HqMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/hq/metrics", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Error al cargar las métricas");
      }
      setMetrics(data as HqMetrics);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => null);
  }, [load]);

  return { metrics, loading, error, reload: load } as const;
}
