import { expect, test } from "@playwright/test";

test.describe("rls", () => {
  const orgId = process.env.E2E_ORG_ID ?? "dummy-org";

  test("requiere sesión para listar solicitudes", async ({ request }) => {
    const response = await request.get(`/api/c/${orgId}/requests`);
    expect(response.status()).toBe(401);
  });
});
