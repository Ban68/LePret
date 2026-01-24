import { CalendarClock, MessageCircle } from "lucide-react";

import type { RequestTimelineItem } from "@/lib/request-timeline";
import { cn } from "@/lib/utils";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const iconByKind = {
  event: CalendarClock,
  message: MessageCircle,
} as const;

export function TimelineFeed({ items }: { items: RequestTimelineItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
        Aún no hay actividad registrada en esta solicitud.
      </div>
    );
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => {
        const Icon = iconByKind[item.item_kind] ?? CalendarClock;
        return (
          <li key={`${item.item_kind}-${item.id}`} className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lp-primary-1/10 text-lp-primary-1">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-neutral-900">{item.title || (item.item_kind === "message" ? "Mensaje" : "Evento")}</p>
                  {item.actor_name ? (
                    <p className="text-xs text-neutral-500">{item.actor_name}</p>
                  ) : item.actor_role ? (
                    <p className="text-xs text-neutral-500 capitalize">{item.actor_role}</p>
                  ) : null}
                </div>
                <span className="text-xs text-neutral-400">{formatDate(item.occurred_at)}</span>
              </div>
              {item.description ? (
                <p
                  className={cn(
                    "mt-3 whitespace-pre-line text-sm text-neutral-700",
                    item.item_kind === "message" && "text-neutral-800",
                  )}
                >
                  {item.description}
                </p>
              ) : null}
              {item.metadata && Object.keys(item.metadata).length ? (
                <pre className="mt-3 overflow-x-auto rounded-md bg-neutral-50 p-3 text-xs text-neutral-500">
                  {JSON.stringify(item.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

