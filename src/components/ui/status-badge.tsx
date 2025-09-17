"use client";

type Props = {
  status: string | null | undefined;
  kind: "invoice" | "request" | "offer";
  className?: string;
};

const MAP: Record<string, { label: string; color: string }> = {
  // Invoices
  uploaded: { label: "Cargada", color: "bg-blue-100 text-blue-800" },
  funded: { label: "Desembolsada", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-700" },
  // Requests
  review: { label: "En revision", color: "bg-amber-100 text-amber-800" },
  offered: { label: "Ofertada", color: "bg-indigo-100 text-indigo-800" },
  accepted: { label: "Aceptada", color: "bg-emerald-100 text-emerald-800" },
  signed: { label: "Firmada", color: "bg-purple-100 text-purple-800" },
  // Offers
  expired: { label: "Expirada", color: "bg-gray-200 text-gray-700" },
};

export function StatusBadge({ status, className }: Props) {
  const key = (status || "").toLowerCase();
  const meta = MAP[key] || { label: status || "-", color: "bg-neutral-100 text-neutral-700" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${meta.color} ${className ?? ""}`}>
      {meta.label}
    </span>
  );
}
