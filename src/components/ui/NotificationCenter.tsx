"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, ExternalLink, Loader2, RefreshCcw } from "lucide-react";
import clsx from "clsx";

const REFRESH_INTERVAL = 30_000;

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

type NotificationLink = {
  href: string;
  label: string;
  isExternal: boolean;
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toLocaleString("es-CO");
  }
}

function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isExternalLink(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function getDataString(data: Record<string, unknown> | null, key: string): string | null {
  if (!data) return null;
  const value = data[key];
  return isValidString(value) ? value.trim() : null;
}

function resolveNotificationLink(notification: NotificationItem): NotificationLink | null {
  const rawData = notification.data && typeof notification.data === "object" ? notification.data : null;
  const data = (rawData as Record<string, unknown> | null) ?? null;

  if (data) {
    const directUrl = ["url", "href"].map((key) => getDataString(data, key)).find(isValidString);
    if (directUrl) {
      return {
        href: directUrl,
        label: "Abrir enlace",
        isExternal: isExternalLink(directUrl),
      };
    }

    const signUrl = getDataString(data, "signUrl");
    if (signUrl) {
      return {
        href: signUrl,
        label: "Firmar documento",
        isExternal: isExternalLink(signUrl),
      };
    }

    const appUrl = getDataString(data, "appUrl");
    if (appUrl) {
      return {
        href: appUrl,
        label: "Abrir documento",
        isExternal: isExternalLink(appUrl),
      };
    }
  }

  const type = notification.type || "";
  const companyId = getDataString(data, "companyId");
  const requestId = getDataString(data, "requestId");

  if (type.startsWith("client_")) {
    if (type === "client_needs_docs" && companyId) {
      return { href: `/c/${companyId}/documents`, label: "Ir a documentos", isExternal: false };
    }
    if (requestId && companyId) {
      return { href: `/c/${companyId}/requests/${requestId}`, label: "Ver solicitud", isExternal: false };
    }
    if (companyId) {
      return { href: `/c/${companyId}/dashboard`, label: "Ir al panel", isExternal: false };
    }
  }

  if (type.startsWith("staff_")) {
    if (type === "staff_kyc_submitted" && companyId) {
      return { href: `/hq/kyc?company=${encodeURIComponent(companyId)}`, label: "Revisar KYC", isExternal: false };
    }
    return { href: "/hq/operaciones", label: "Ir a operaciones", isExternal: false };
  }

  if (companyId) {
    return { href: `/c/${companyId}/dashboard`, label: "Ver detalles", isExternal: false };
  }

  return null;
}

export function NotificationCenter() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const response = await fetch("/api/notifications?perPage=20", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (response.status === 401) {
        if (mountedRef.current) {
          setIsUnauthorized(true);
          setNotifications([]);
        }
        return;
      }

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok === false) {
        const message = payload?.error || "No se pudieron cargar las notificaciones.";
        throw new Error(message);
      }

      const items = (payload?.data ?? []) as NotificationItem[];
      if (mountedRef.current) {
        setIsUnauthorized(false);
        setNotifications(items);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : "Error al cargar notificaciones.";
      setError(message);
    } finally {
      if (mountedRef.current && showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchNotifications(true);
    const interval = setInterval(() => {
      fetchNotifications(false);
    }, REFRESH_INTERVAL);
    return () => {
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = useMemo(
    () => notifications.reduce((total, item) => (item.is_read ? total : total + 1), 0),
    [notifications],
  );

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) => prev.map((item) => (item.id === notificationId ? { ...item, is_read: true } : item)));
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error();
      }
    } catch {
      fetchNotifications(false);
    }
  }, [fetchNotifications]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleRefresh = useCallback(() => {
    fetchNotifications(true);
  }, [fetchNotifications]);

  const handleOpenLink = useCallback(
    async (notification: NotificationItem, link: NotificationLink, event: ReactMouseEvent) => {
      event.preventDefault();
      if (!notification.is_read) {
        await markAsRead(notification.id);
      }
      setIsOpen(false);
      if (link.isExternal) {
        window.open(link.href, "_blank", "noopener,noreferrer");
      } else {
        router.push(link.href);
      }
    },
    [markAsRead, router],
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-lp-sec-4/50 bg-white/70 text-lp-primary-1 transition-colors hover:bg-lp-primary-2/10"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[0.65rem] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        <span className="sr-only">Abrir centro de notificaciones</span>
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Centro de notificaciones"
          className="absolute right-0 z-50 mt-3 w-96 max-w-[90vw] rounded-xl border border-lp-sec-4/40 bg-white/95 p-4 shadow-2xl backdrop-blur"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-lp-primary-1">Notificaciones</p>
              <p className="text-xs text-lp-sec-3">
                {unreadCount === 0
                  ? "No tienes notificaciones pendientes"
                  : `${unreadCount} notificación${unreadCount === 1 ? "" : "es"} sin leer`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded-md border border-lp-sec-4/40 px-2 py-1 text-xs font-medium text-lp-primary-1 transition-colors hover:bg-lp-primary-2/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Actualizar
            </button>
          </div>

          {isUnauthorized ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800">
              Inicia sesión para ver tus notificaciones.
            </div>
          ) : error ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-red-200 bg-red-50/80 p-3 text-xs text-red-700">{error}</div>
              <button
                type="button"
                onClick={handleRefresh}
                className="text-xs font-medium text-lp-primary-1 underline"
              >
                Reintentar
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-lg border border-lp-sec-4/40 bg-lp-primary-2/10 p-4 text-sm text-lp-sec-3">
              No tienes notificaciones por ahora.
            </div>
          ) : (
            <ul className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {notifications.map((notification) => {
                const link = resolveNotificationLink(notification);
                return (
                  <li
                    key={notification.id}
                    className={clsx(
                      "rounded-lg border border-lp-sec-4/40 bg-white/90 p-3 shadow-sm transition-colors",
                      notification.is_read ? "opacity-75" : "ring-1 ring-lp-primary-2/30",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <p
                          className={clsx(
                            "text-sm",
                            notification.is_read ? "text-lp-sec-3" : "font-semibold text-lp-primary-1",
                          )}
                        >
                          {notification.message}
                        </p>
                        <p className="text-xs text-lp-sec-3">{formatDateTime(notification.created_at)}</p>
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
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => markAsRead(notification.id)}
                            className="rounded-full border border-lp-primary-2/40 px-2 py-1 text-xs font-medium text-lp-primary-1 transition-colors hover:bg-lp-primary-2/10"
                          >
                            Marcar leído
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
