import { test, expect } from "@playwright/test";

test("flujo cliente básico", async ({ page }) => {
  // Ajusta a tu login real
  await page.goto("/login");
  // ... si usas magic link, simula tras cookie, etc.

  // Navega al portal (asumiendo cookie o login hecho)
  await page.goto("/c/ORG_ID_DEMO");
  await expect(page.getByText("Resumen")).toBeVisible();

  // Ir a facturas y ver listado / empty state
  await page.goto("/c/ORG_ID_DEMO/invoices");
  await expect(page.getByText(/Facturas/i)).toBeVisible();
});

