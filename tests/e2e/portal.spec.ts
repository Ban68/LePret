import { expect, test } from "@playwright/test";

const orgId = process.env.E2E_ORG_ID;
const requestId = process.env.E2E_REQUEST_ID;
const simulatorRequestId = process.env.E2E_SIMULATOR_REQUEST_ID ?? requestId;

const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test.describe("portal cliente", () => {
  test.skip(!orgId, "Define E2E_ORG_ID en tu entorno para ejecutar estas pruebas.");

  test("flujo cliente basico", async ({ page }) => {
    await page.goto("/login");
    await page.goto(`/c/${orgId}`);
    await expect(page.getByRole("heading", { name: /resumen/i })).toBeVisible();
    await page.goto(`/c/${orgId}/invoices`);
    await expect(page.getByRole("heading", { name: /facturas/i })).toBeVisible();
  });

  test("historial de solicitud disponible", async ({ page }) => {
    test.skip(!requestId, "Define E2E_REQUEST_ID para validar el historial de solicitudes.");

    await page.goto(`/c/${orgId}/requests/${requestId}`);
    await expect(page.getByRole("heading", { name: /Historial de la solicitud/i })).toBeVisible();
    await expect(page.getByText(/Próximos pasos/i)).toBeVisible();
  });

  test("simulador de oferta muestra métricas", async ({ page }) => {
    test.skip(!simulatorRequestId, "Define E2E_SIMULATOR_REQUEST_ID o E2E_REQUEST_ID para validar el simulador de ofertas.");

    const shortIdPattern = escapeForRegExp(simulatorRequestId!.slice(0, 8));

    await page.goto(`/c/${orgId}/requests`);
    const requestRow = page.getByRole("row", { name: new RegExp(shortIdPattern, "i") });

    const simulatorToggle = requestRow.getByRole("button", { name: /Ver simulador/i });
    await expect(simulatorToggle).toBeVisible();
    await simulatorToggle.click();

    await expect(requestRow.getByText(/Monto solicitado/i)).toBeVisible();
    await expect(requestRow.getByText(/Desembolso neto/i)).toBeVisible();
  });
});



