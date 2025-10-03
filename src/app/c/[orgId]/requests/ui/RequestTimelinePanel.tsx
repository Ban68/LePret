"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { TimelineComposer } from "@/components/app/timeline/TimelineComposer";
import { TimelineFeed } from "@/components/app/timeline/TimelineFeed";
import { TimelineNextSteps, type NextSteps } from "@/components/app/timeline/TimelineNextSteps";
import { TimelineRealtimeBridge } from "@/components/app/timeline/TimelineRealtimeBridge";
import { Button } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import type { RequestTimelineItem } from "@/lib/request-timeline";

const PANEL_TRANSITION_MS = 180;

type TimelinePayload = {
  request: {
    id: string;
    status: string;
    requested_amount: number;
    created_at: string;
  };
  timeline: RequestTimelineItem[];
  nextSteps: NextSteps;
};

type RequestTimelinePanelProps = {
  orgId: string;
  requestId: string | null;
  onClose: () => void;
  onRefreshList?: () => void | Promise<void>;
};

export function RequestTimelinePanel({ orgId, requestId, onClose, onRefreshList }: RequestTimelinePanelProps) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    data: TimelinePayload | null;
  }>({ loading: false, error: null, data: null });
  const [visible, setVisible] = useState(false);

  const fetchTimeline = useCallback(
    async (id: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const response = await fetch(`/api/requests/${id}/timeline`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "No se pudo cargar el historial");
        }

        const data: TimelinePayload = {
          request: {
            id: payload.request?.id ?? id,
            status: payload.request?.status ?? "",
            requested_amount: Number(payload.request?.requested_amount ?? 0),
            created_at: payload.request?.created_at ?? new Date().toISOString(),
          },
          timeline: Array.isArray(payload.timeline) ? (payload.timeline as RequestTimelineItem[]) : [],
          nextSteps: (payload.nextSteps ?? null) as NextSteps,
        };

        setState({ loading: false, error: null, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error inesperado";
        setState({ loading: false, error: message, data: null });
      }
    },
    [],
  );

  useEffect(() => {
    if (!requestId) {
      setVisible(false);
      setState({ loading: false, error: null, data: null });
      return;
    }
    setVisible(true);
    void fetchTimeline(requestId);
  }, [requestId, fetchTimeline]);

  useEffect(() => {
    if (!requestId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [requestId, onClose]);

  useEffect(() => {
    if (!requestId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [requestId]);

  const closeWithAnimation = useCallback(() => {
    setVisible(false);
    window.setTimeout(onClose, PANEL_TRANSITION_MS);
  }, [onClose]);

  const handleComposerSent = useCallback(async () => {
    if (!requestId) {
      return false;
    }
    await fetchTimeline(requestId);
    if (onRefreshList) {
      await onRefreshList();
    }
    return false;
  }, [fetchTimeline, onRefreshList, requestId]);

  const handleRealtimeChange = useCallback(() => {
    if (requestId) {
      void fetchTimeline(requestId);
    }
  }, [fetchTimeline, requestId]);

  const panelClasses = useMemo(
    () =>
      cn(
        "fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6 transition-opacity",
        visible ? "opacity-100" : "opacity-0",
      ),
    [visible],
  );

  if (!requestId) {
    return null;
  }

  const formattedCreatedAt = state.data
    ? new Date(state.data.request.created_at).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className={panelClasses} role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={closeWithAnimation} aria-hidden="true" />
      <div className="relative z-10 flex w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Historial de la solicitud</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-neutral-700">
              <span className="font-semibold text-neutral-900">#{requestId.slice(0, 8)}</span>
              {state.data ? <StatusBadge status={state.data.request.status} kind="request" /> : null}
              {formattedCreatedAt ? (
                <span className="text-xs text-neutral-500">Creada {formattedCreatedAt}</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/c/${orgId}/requests/${state.data?.request.id ?? requestId}`}>
                Ver a pantalla completa
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={closeWithAnimation}>
              Cerrar
            </Button>
          </div>
        </header>
        <div className="max-h-[80vh] overflow-y-auto bg-neutral-50 px-6 py-6">
          {state.loading ? (
            <div className="rounded-md border border-dashed border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
              Cargando historial...
            </div>
          ) : null}
          {state.error ? (
            <InlineBanner
              tone="error"
              title="No pudimos cargar el historial"
              description={state.error}
              className="mb-4"
            />
          ) : null}
          {!state.loading && !state.error && state.data ? (
            <div className="space-y-6">
              <TimelineNextSteps status={state.data.request.status} nextSteps={state.data.nextSteps} />
              <TimelineComposer requestId={requestId} disabled={state.loading} onSent={handleComposerSent} />
              <TimelineFeed items={state.data.timeline} />
              <TimelineRealtimeBridge requestId={requestId} onChange={handleRealtimeChange} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
