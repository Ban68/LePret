import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { extractInvoiceFieldsFromText, parseInvoicePdf } from "../../src/lib/invoices/pdf-parser";

test("parseInvoicePdf extracts structured data from sample PDF", async (t) => {
  const fixturePath = join(process.cwd(), "tests", "fixtures", "invoice-sample.pdf");
  const buffer = readFileSync(fixturePath);

  const result = await parseInvoicePdf(buffer);

  await t.test("amount is normalized", () => {
    assert.equal(result.amount, 1234.56);
  });

  await t.test("issue and due dates are normalized to ISO", () => {
    assert.equal(result.issue_date, "2024-03-12");
    assert.equal(result.due_date, "2024-03-26");
  });

  await t.test("payer information is extracted", () => {
    assert.equal(result.payer_name, "Example Corp");
    assert.equal(result.payer_tax_id, "123456789-0");
  });
});

test("extractInvoiceFieldsFromText handles spanish labels", () => {
  const text = `Factura 99\nFecha de emisión: 5 de abril de 2024\nFecha de vencimiento: 20-04-2024\nMonto total: COP $2.345.678,00\nCliente: Industrias Ejemplo S.A.\nNIT: 900123456-7`;
  const result = extractInvoiceFieldsFromText(text);

  assert.equal(result.issue_date, "2024-04-05");
  assert.equal(result.due_date, "2024-04-20");
  assert.equal(result.amount, 2345678);
  assert.equal(result.payer_name, "Industrias Ejemplo S.A.");
  assert.equal(result.payer_tax_id, "900123456-7");
});
