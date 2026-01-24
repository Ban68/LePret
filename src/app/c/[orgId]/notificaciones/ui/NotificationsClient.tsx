"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineBanner } from "@/components/ui/inline-banner";
import {
  extractNotificationCompanyId,
  formatNotificationDateTime,
  formatNotificationType,
  resolveNotificationLink,
} from "@/lib/notification-helpers";
import type { NotificationItem, NotificationLink } from "@/lib/notification-helpers";

const PAGE_SIZE = 20;
const SKELETON_ITEMS = Array.from({ length: 4 }, (_, index) => index);

type ApiResponse = {
  ok: boolean;
  error?: string;
  data?: NotificationItem[];
  pagination?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
};

type PaginationState = {
  page: number;
  totalPages: number;
};

function NotificationsSkeleton() {
  return (
    <div className="space-y-3">
      {SKELETON_ITEMS.map((item) => (
        <div key={item} className="animate-pulse rounded-xl border border-lp-sec-4/40 bg-white/80 p-4 shadow-sm">
          <div className="h-3 w-24 rounded-full bg-lp-sec-4/30" />
          <div className="mt-3 h-4 w-3/4 rounded-full bg-lp-sec-4/30" />
          <div className="mt-2 h-3 w-1/3 rounded-full bg-lp-sec-4/20" />
          <div className="mt-4 h-3 w-32 rounded-full bg-lp-sec-4/20" />
        </div>
      ))}
    </div>
  );
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function NotificationsClient({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({ page: 0, totalPages: 1 });
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const loadPage = useCallback(
    async (pageToLoad: number, { replace }: { replace: boolean }) => {
      if (!replace) {
        if (pagination.page >= pageToLoad) {
          return;
        }
        if (pagination.totalPages > 0 && pageToLoad > pagination.totalPages) {
          return;
        }
      }

      if (replace) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(pageToLoad));
        params.set("perPage", String(PAGE_SIZE));
        if (readFilter === "unread") {
          params.set("is_read", "false");
        } else if (readFilter === "read") {
          params.set("is_read", "true");
        }

        const response = await fetch(`/api/notifications?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as ApiResponse | null;
        if (!response.ok || !payload || payload.ok === false) {
          const message = payload?.error || "No se pudieron cargar las notificaciones.";
          throw new Error(message);
        }

        const rows = payload.data ?? [];
        setNotifications((prev) => {
          if (replace) {
            return rows;
          }
          const existing = new Map(prev.map((item) => [item.id, item] as const));
          rows.forEach((row) => {
            existing.set(row.id, row);
          });
          return Array.from(existing.values()).sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
        });

        const responsePagination = payload.pagination;
        setPagination({
          page: responsePagination?.page ?? pageToLoad,
          totalPages: responsePagination?.totalPages ?? pageToLoad,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado al cargar notificaciones.";
        setError(message);
      } finally {
        if (replace) {
          setIsLoading(false);
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    [pagination.page, pagination.totalPages, readFilter],
  );

  useEffect(() => {
    void loadPage(1, { replace: true });
  }, [loadPage]);

  useEffect(() => {
    setTypeFilter("all");
  }, [readFilter]);

  const relevantNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const companyId = extractNotificationCompanyId(item);
      if (!companyId) return true;
      return companyId === orgId;
    });
  }, [notifications, orgId]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    relevantNotifications.forEach((item) => {
      if (item.type) {
        set.add(item.type);
      }
    });
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [relevantNotifications]);

  useEffect(() => {
    if (!typeOptions.includes(typeFilter)) {
      setTypeFilter("all");
    }
  }, [typeOptions, typeFilter]);

  const visibleNotifications = useMemo(() => {
    if (typeFilter === "all") {
      return relevantNotifications;
    }
    return relevantNotifications.filter((item) => item.type === typeFilter);
  }, [relevantNotifications, typeFilter]);

  const unreadCount = useMemo(
    () => notifications.reduce((total, item) => (item.is_read ? total : total + 1), 0),
    [notifications],
  );

  const hasMore = pagination.page > 0 && pagination.page < pagination.totalPages;

  const handleRefresh = useCallback(() => {
    void loadPage(1, { replace: true });
  }, [loadPage]);

  const handleLoadMore = useCallback(() => {
    void loadPage(pagination.page + 1, { replace: false });
  }, [loadPage, pagination.page]);

  const handleMarkAsRead = useCallback(
    async (notification: NotificationItem) => {
      if (notification.is_read) return;
      setMarkingId(notification.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)),
      );
      try {
        const response = await fetch(`/api/notifications/${notification.id}`, { method: "PATCH" });
        if (!response.ok) {
          throw new Error();
        }
      } catch (err) {
        console.error(err);
        await loadPage(1, { replace: true });
      } finally {
        setMarkingId(null);
      }
    },
    [loadPage],
  );

  const handleOpenLink = useCallback(
    async (notification: NotificationItem, link: NotificationLink, event: ReactMouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (!notification.is_read) {
        await handleMarkAsRead(notification);
      }

      if (link.isExternal) {
        window.open(link.href, "_blank", "noopener,noreferrer");
      } else {
        router.push(link.href);
      }
    },
    [handleMarkAsRead, router],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-lp-primary-1">Notificaciones</h1>
          <p className="text-sm text-lp-sec-3">
            Revisa el historial completo de alertas y mensajes relevantes para tu empresa.
          </p>
          <p className="mt-1 text-xs text-lp-sec-4">
            {unreadCount === 0
              ? "No tienes notificaciones pendientes."
              : `${unreadCount} notificación${unreadCount === 1 ? "" : "es"} sin leer.`}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Actualizar
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-sm">
          <span className="text-xs font-medium text-lp-sec-3">Estado</span>
          <select
            value={readFilter}
            onChange={(event) => setReadFilter(event.target.value as typeof readFilter)}
            className="mt-1 w-48 rounded-md border border-lp-sec-4/60 bg-white px-3 py-2 text-sm shadow-sm focus:border-lp-primary-1 focus:outline-none"
          >
            <option value="all">Todas</option>
            <option value="unread">No leídas</option>
            <option value="read">Leídas</option>
          </select>
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-xs font-medium text-lp-sec-3">Tipo</span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="mt-1 w-56 rounded-md border border-lp-sec-4/60 bg-white px-3 py-2 text-sm shadow-sm focus:border-lp-primary-1 focus:outline-none"
          >
            {typeOptions.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "Todos" : formatNotificationType(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <InlineBanner
          tone="error"
          title="No pudimos cargar las notificaciones"
          description={error}
          action={
            <Button variant="link" onClick={handleRefresh} className="px-0 text-sm text-inherit">
              Reintentar
            </Button>
          }
        />
      )}

      {isLoading ? (
        <NotificationsSkeleton />
      ) : visibleNotifications.length === 0 ? (
        <EmptyState
          title="No hay notificaciones"
          description={
            readFilter === "unread"
              ? "Ya has revisado todas tus notificaciones."
              : "Cuando tengas actividad nueva, la verás listada aquí."
          }
          action={{ label: "Actualizar", onClick: handleRefresh }}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-lp-sec-4">
            {hasMore
              ? `Mostrando ${visibleNotifications.length} notificaciones. Carga más para ver el historial completo.`
              : `Mostrando ${visibleNotifications.length} notificaciones.`}
          </p>
          <ul className="space-y-4">
            {visibleNotifications.map((notification) => {
              const link = resolveNotificationLink(notification);
              const isUnread = !notification.is_read;
              return (
                <li
                  key={notification.id}
                  className={classNames(
                    "rounded-xl border border-lp-sec-4/40 bg-white/90 p-4 shadow-sm transition-colors",
                    isUnread ? "ring-1 ring-lp-primary-2/30" : "opacity-80",
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-lp-sec-3">
                        <span className="rounded-full bg-lp-primary-2/20 px-2 py-0.5 font-medium text-lp-primary-1">
                          {formatNotificationType(notification.type)}
                        </span>
                        {isUnread && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Sin leer
                          </span>
                        )}
                      </div>
                      <p className={classNames("text-sm", isUnread ? "font-semibold text-lp-primary-1" : "text-lp-sec-3")}
                      >
                        {notification.message}
                      </p>
                      <p className="text-xs text-lp-sec-3">{formatNotificationDateTime(notification.created_at)}</p>
                      {link && (
                        <div>
                          {link.isExternal ? (
                            <a
                              href={link.href}
                              onClick={(event) => handleOpenLink(notification, link, event)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-lp-primary-1 hover:underline"
                            >
                              {link.label}
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                          ) : (
                            <Link
                              href={link.href}
                              onClick={(event) => handleOpenLink(notification, link, event)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-lp-primary-1 hover:underline"
                            >
                              {link.label}
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center">
                      {notification.is_read ? (
                        <span className="inline-flex items-center gap-2 text-xs text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          Leída
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsRead(notification)}
                          disabled={markingId === notification.id}
                        >
                          {markingId === notification.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Marcar como leída"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {hasMore && visibleNotifications.length > 0 && (
            <div className="flex justify-center">
              <Button onClick={handleLoadMore} disabled={isLoadingMore} variant="outline">
                {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cargar más"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
