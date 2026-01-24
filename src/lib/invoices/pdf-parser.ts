import pdfParse from "pdf-parse";

export interface InvoicePdfParserResult {
  amount: number | null;
  issue_date: string | null;
  due_date: string | null;
  payer_name: string | null;
  payer_tax_id: string | null;
}

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

const AMOUNT_PATTERNS = [
  /total\s+(?:amount|a\s+pagar|monto|invoice|factura)?[:\-\s]*([$€£¥]?\s*[0-9.,]+(?:\s*[A-Z]{2,4})?)/i,
  /monto\s+total[:\-\s]*([$€£¥]?\s*[0-9.,]+(?:\s*[A-Z]{2,4})?)/i,
  /importe\s+total[:\-\s]*([$€£¥]?\s*[0-9.,]+(?:\s*[A-Z]{2,4})?)/i,
  /valor\s+total[:\-\s]*([$€£¥]?\s*[0-9.,]+(?:\s*[A-Z]{2,4})?)/i,
];

const DATE_PATTERNS = [
  /(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/,
  /(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})/,
  /(\d{1,2})\s+([a-záéíóúñ]+)\s+(\d{2,4})/i,
  /([a-záéíóúñ]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s+(\d{2,4})/i,
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeYear(input: string): number {
  const year = Number.parseInt(input, 10);
  if (input.length === 2) {
    return year >= 70 ? 1900 + year : 2000 + year;
  }
  return year;
}

function normalizeDate(rawValue: string | null): string | null {
  if (!rawValue) return null;
  const cleaned = normalizeWhitespace(rawValue)
    .replace(/[,]/g, " ")
    .replace(/\bde\b/gi, " ");

  for (let index = 0; index < DATE_PATTERNS.length; index += 1) {
    const pattern = DATE_PATTERNS[index];
    const match = cleaned.match(pattern);
    if (!match) continue;

    if (index === 0) {
      const day = Number.parseInt(match[1], 10);
      const month = Number.parseInt(match[2], 10);
      const year = normalizeYear(match[3]);
      if (isValidDate(year, month, day)) return formatDate(year, month, day);
    }

    if (index === 1) {
      const year = normalizeYear(match[1]);
      const month = Number.parseInt(match[2], 10);
      const day = Number.parseInt(match[3], 10);
      if (isValidDate(year, month, day)) return formatDate(year, month, day);
    }

    if (index === 2) {
      const day = Number.parseInt(match[1], 10);
      const month = MONTHS[match[2].toLowerCase()];
      const year = normalizeYear(match[3]);
      if (month && isValidDate(year, Number.parseInt(month, 10), day)) {
        return formatDate(year, Number.parseInt(month, 10), day);
      }
    }

    if (index === 3) {
      const month = MONTHS[match[1].toLowerCase()];
      const day = Number.parseInt(match[2], 10);
      const year = normalizeYear(match[3]);
      if (month && isValidDate(year, Number.parseInt(month, 10), day)) {
        return formatDate(year, Number.parseInt(month, 10), day);
      }
    }
  }

  return null;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function formatDate(year: number, month: number, day: number): string {
  const mm = month.toString().padStart(2, "0");
  const dd = day.toString().padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function normalizeAmount(rawValue: string | null): number | null {
  if (!rawValue) return null;
  const cleaned = rawValue.replace(/[^0-9,.-]/g, "");
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }

  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function extractFirstMatch(lines: string[], patterns: RegExp[]): string | null {
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
  }
  return null;
}

function extractAmount(lines: string[]): number | null {
  const candidate = extractFirstMatch(lines, AMOUNT_PATTERNS);
  const normalized = normalizeAmount(candidate);
  if (normalized !== null) return normalized;

  const fallbackPattern = /([$€£¥]?\s*[0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2}))/g;
  let fallback: number | null = null;
  for (const line of lines) {
    let match: RegExpExecArray | null;
    while ((match = fallbackPattern.exec(line))) {
      const amount = normalizeAmount(match[1]);
      if (amount !== null && (fallback === null || amount > fallback)) {
        fallback = amount;
      }
    }
  }
  return fallback;
}

function extractDateByKeywords(lines: string[], keywords: string[], fallback: "earliest" | "latest"): string | null {
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (keywords.some((keyword) => lower.includes(keyword))) {
      const normalized = normalizeDate(line);
      if (normalized) return normalized;
    }
  }

  const allDates: string[] = [];
  for (const line of lines) {
    const normalized = normalizeDate(line);
    if (normalized) {
      allDates.push(normalized);
    }
  }
  if (allDates.length === 0) return null;

  allDates.sort();
  return fallback === "earliest" ? allDates[0] : allDates[allDates.length - 1];
}

interface TaxMatch {
  value: string;
  lineIndex: number;
}

function extractTaxId(lines: string[]): TaxMatch | null {
  const patterns = [
    /(nit|ruc|rfc|rut|nif|cuit|tax\s*id|vat)[:\-\s]*([a-z0-9.-]+)/i,
    /\b([A-Z0-9]{6,}-?[A-Z0-9]*)\b/,
  ];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const value = match[2] ?? match[1];
        if (value && /[0-9A-Z]/i.test(value)) {
          return { value: value.trim(), lineIndex: index };
        }
      }
    }
  }
  return null;
}

function extractPayerName(lines: string[], taxMatch: TaxMatch | null): string | null {
  const patterns = [
    /(payer|cliente|raz[oó]n\s+social|company|empresa|pagador)[:\-\s]+(.+)/i,
    /(nombre\s+del\s+pagador)[:\-\s]+(.+)/i,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const candidate = match[2] ?? match[1];
        if (candidate) {
          const cleaned = candidate.replace(/[^\p{L}\p{N}.\-\s]/gu, "").trim();
          if (cleaned) return cleaned;
        }
      }
    }
  }

  if (taxMatch && taxMatch.lineIndex > 0) {
    const previousLine = lines[taxMatch.lineIndex - 1];
    if (previousLine) {
      const cleaned = previousLine.replace(/[^\p{L}\p{N}.\-\s]/gu, "").trim();
      if (cleaned) {
        return cleaned;
      }
    }
  }

  return null;
}

export function extractInvoiceFieldsFromText(text: string): InvoicePdfParserResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const amount = extractAmount(lines);
  const issueDate = extractDateByKeywords(
    lines,
    ["issue date", "fecha de emisión", "fecha de emision", "fecha factura", "issued"],
    "earliest",
  );
  const dueDate = extractDateByKeywords(
    lines,
    ["due date", "fecha de venc", "vence", "payment due", "fecha limite"],
    "latest",
  );
  const taxMatch = extractTaxId(lines);
  const payerName = extractPayerName(lines, taxMatch);

  return {
    amount,
    issue_date: issueDate,
    due_date: dueDate,
    payer_name: payerName,
    payer_tax_id: taxMatch ? taxMatch.value : null,
  };
}

export async function parseInvoicePdf(buffer: Buffer): Promise<InvoicePdfParserResult> {
  const { text } = await pdfParse(buffer);
  return extractInvoiceFieldsFromText(text);
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { text } = await pdfParse(buffer);
  return text;
}
