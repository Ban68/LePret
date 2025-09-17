import { test, expect } from "@playwright/test";

const orgId = process.env.E2E_ORG_ID;

test.describe("portal cliente", () => {
  test.skip(!orgId, "Define E2E_ORG_ID en tu entorno para ejecutar este smoke test.");

  test("flujo cliente basico", async ({ page }) => {
    // Se asume que ya existe una sesion reutilizable (via storageState) o que el login no requiere interaccion manual.
    await page.goto("/login");

    // Navega al dashboard resumido de la organizacion proporcionada.
    await page.goto(`/c/${orgId}`);
    await expect(page.getByRole("heading", { name: /resumen/i })).toBeVisible();

    // Visita el listado de facturas.
    await page.goto(`/c/${orgId}/invoices`);
    await expect(page.getByRole("heading", { name: /facturas/i })).toBeVisible();
  });
});

