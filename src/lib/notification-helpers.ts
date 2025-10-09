export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationLink = {
  href: string;
  label: string;
  isExternal: boolean;
};

function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isExternalLink(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function getDataString(data: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!data) return null;
  const value = data[key];
  return isValidString(value) ? value.trim() : null;
}

export function extractNotificationCompanyId(notification: NotificationItem): string | null {
  const data = notification.data && typeof notification.data === "object" ? notification.data : null;
  const companyId = getDataString(data, "companyId") || getDataString(data, "company_id");
  return companyId;
}

export function formatNotificationDateTime(value: string): string {
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

export function resolveNotificationLink(notification: NotificationItem): NotificationLink | null {
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
  const companyId = getDataString(data, "companyId") || getDataString(data, "company_id");
  const requestId = getDataString(data, "requestId") || getDataString(data, "request_id");

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

const TYPE_LABELS: Record<string, string> = {
  client_offer_generated: "Oferta generada",
  client_needs_docs: "Documentos requeridos",
  request_created: "Nueva solicitud",
  staff_new_request: "Nueva solicitud (staff)",
  staff_kyc_submitted: "KYC enviado",
};

export function formatNotificationType(type: string | null | undefined): string {
  if (!type) return "General";
  const normalized = type.toLowerCase();
  if (TYPE_LABELS[normalized]) {
    return TYPE_LABELS[normalized];
  }
  return type
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
