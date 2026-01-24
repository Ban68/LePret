export const MEMBER_ROLE_VALUES = ["OWNER", "ADMIN", "OPERATOR", "VIEWER"] as const;
export type MemberRole = (typeof MEMBER_ROLE_VALUES)[number];

const MEMBER_ROLE_SET = new Set<MemberRole>(MEMBER_ROLE_VALUES);

const LEGACY_MEMBER_ROLE_MAP: Record<string, MemberRole> = {
  client: "VIEWER",
  admin: "ADMIN",
  investor: "VIEWER",
};

export const DEFAULT_MEMBER_ROLE: MemberRole = "VIEWER";

export function normalizeMemberRole(value: unknown): MemberRole | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const upper = trimmed.toUpperCase();
  if (MEMBER_ROLE_SET.has(upper as MemberRole)) {
    return upper as MemberRole;
  }
  const lower = trimmed.toLowerCase();
  const mapped = LEGACY_MEMBER_ROLE_MAP[lower];
  return mapped ?? null;
}

export function parseMemberRole(value: unknown, fallback?: MemberRole): MemberRole {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error("Invalid member role");
  }
  const normalized = normalizeMemberRole(value);
  if (!normalized) {
    throw new Error("Invalid member role");
  }
  return normalized;
}

export function requireMemberRole(value: unknown): MemberRole {
  const normalized = normalizeMemberRole(value);
  if (!normalized) {
    throw new Error("Invalid member role");
  }
  return normalized;
}

export const MANAGER_MEMBER_ROLES = new Set<MemberRole>(["OWNER", "ADMIN"]);

export function canManageMembership(role: MemberRole | null | undefined): boolean {
  if (!role) {
    return false;
  }
  return MANAGER_MEMBER_ROLES.has(role);
}

export const MEMBER_STATUS_VALUES = ["ACTIVE", "INVITED", "DISABLED"] as const;
export type MemberStatus = (typeof MEMBER_STATUS_VALUES)[number];

const MEMBER_STATUS_SET = new Set<MemberStatus>(MEMBER_STATUS_VALUES);

export const DEFAULT_MEMBER_STATUS: MemberStatus = "INVITED";

export function normalizeMemberStatus(value: unknown): MemberStatus | null {
  if (typeof value !== "string") {
    return null;
  }
  const upper = value.trim().toUpperCase();
  if (!upper) {
    return null;
  }
  if (MEMBER_STATUS_SET.has(upper as MemberStatus)) {
    return upper as MemberStatus;
  }
  return null;
}

export function parseMemberStatus(value: unknown, fallback?: MemberStatus): MemberStatus {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error("Invalid member status");
  }
  const normalized = normalizeMemberStatus(value);
  if (!normalized) {
    throw new Error("Invalid member status");
  }
  return normalized;
}

export function requireMemberStatus(value: unknown): MemberStatus {
  const normalized = normalizeMemberStatus(value);
  if (!normalized) {
    throw new Error("Invalid member status");
  }
  return normalized;
}
