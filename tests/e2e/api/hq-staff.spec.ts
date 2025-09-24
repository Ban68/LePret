import { test, expect } from "@playwright/test";

import {
  POST as createOrg,
  __setOrgRouteCookies,
  __setOrgRouteSupabaseAdmin,
  __setOrgRouteSupabaseClientFactory,
} from "@/app/api/orgs/route";
import {
  PATCH as updateMembership,
  POST as createMembership,
  __setMembershipsCookies,
  __setMembershipsSupabaseAdmin,
  __setMembershipsSupabaseClientFactory,
} from "@/app/api/c/[orgId]/memberships/route";

type MaybeSingleResult<T> = { data: T; error: { message?: string } | null };

function createMaybeSingleChain<T>(result: T, error: { message?: string } | null = null) {
  const maybeSingle = async (): Promise<MaybeSingleResult<T>> => ({ data: result, error });
  const eq = () => ({ eq, maybeSingle });
  const select = () => ({ eq });
  return { select };
}

const emptyCookieStore = () => ({} as any);

function createOrgSupabaseMock(profileIsStaff: boolean) {
  return {
    auth: {
      async getSession() {
        return {
          data: {
            session: {
              user: {
                id: "user-actor",
                email: "actor@example.com",
                user_metadata: {},
              },
            },
          },
        };
      },
    },
    from(table: string) {
      if (table === "profiles") {
        return createMaybeSingleChain({ is_staff: profileIsStaff });
      }
      throw new Error(`Unexpected table access: ${table}`);
    },
  };
}

function createMembershipSupabaseMock() {
  return {
    auth: {
      async getSession() {
        return {
          data: {
            session: {
              user: {
                id: "user-actor",
                email: "actor@example.com",
                user_metadata: {},
              },
            },
          },
        };
      },
    },
    from(table: string) {
      if (table === "profiles") {
        return createMaybeSingleChain({ is_staff: false });
      }
      if (table === "memberships") {
        return createMaybeSingleChain({ role: "OWNER", status: "ACTIVE" });
      }
      throw new Error(`Unexpected table access: ${table}`);
    },
  };
}

test.afterEach(() => {
  __setOrgRouteSupabaseClientFactory(null);
  __setOrgRouteSupabaseAdmin(null);
  __setOrgRouteCookies(null);
  __setMembershipsSupabaseClientFactory(null);
  __setMembershipsSupabaseAdmin(null);
  __setMembershipsCookies(null);
});

test("impide que personal HQ cree organizaciones", async () => {
  __setOrgRouteCookies(emptyCookieStore);
  __setOrgRouteSupabaseClientFactory(() => createOrgSupabaseMock(true) as any);
  __setOrgRouteSupabaseAdmin({
    from() {
      throw new Error("No se esperaba acceso a supabaseAdmin en este escenario");
    },
  } as any);

  const request = new Request("http://localhost/api/orgs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", type: "CLIENT" }),
  });

  const response = await createOrg(request);
  const body = await response.json();

  expect(response.status).toBe(403);
  expect(body).toMatchObject({ ok: false, code: "HQ_STAFF" });
});

test("impide altas de miembros para personal HQ", async () => {
  __setMembershipsCookies(emptyCookieStore);
  __setMembershipsSupabaseClientFactory(() => createMembershipSupabaseMock() as any);
  __setMembershipsSupabaseAdmin({
    from(table: string) {
      if (table === "profiles") {
        return createMaybeSingleChain({ is_staff: true });
      }
      throw new Error(`No se esperaba acceso a ${table}`);
    },
    auth: {},
  } as any);

  const request = new Request("http://localhost/api/c/demo/memberships", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "hq-user", role: "ADMIN" }),
  });

  const response = await createMembership(request, { params: Promise.resolve({ orgId: "demo" }) });
  const body = await response.json();

  expect(response.status).toBe(403);
  expect(body).toMatchObject({ ok: false, code: "HQ_STAFF" });
});

test("impide actualizaciones de miembros para personal HQ", async () => {
  __setMembershipsCookies(emptyCookieStore);
  __setMembershipsSupabaseClientFactory(() => createMembershipSupabaseMock() as any);
  __setMembershipsSupabaseAdmin({
    from(table: string) {
      if (table === "profiles") {
        return createMaybeSingleChain({ is_staff: true });
      }
      if (table === "memberships") {
        return {
          update() {
            throw new Error("No se esperaba ejecutar update para personal HQ");
          },
        };
      }
      throw new Error(`No se esperaba acceso a ${table}`);
    },
    auth: {},
  } as any);

  const request = new Request("http://localhost/api/c/demo/memberships", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "hq-user", status: "ACTIVE" }),
  });

  const response = await updateMembership(request, { params: Promise.resolve({ orgId: "demo" }) });
  const body = await response.json();

  expect(response.status).toBe(403);
  expect(body).toMatchObject({ ok: false, code: "HQ_STAFF" });
});

