import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { parseInvoicePdf } from "@/lib/invoices/pdf-parser";

const MAX_INVOICE_PDF_SIZE_BYTES = 10 * 1024 * 1024;

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { orgId } = await params;
    if (!orgId) {
      return NextResponse.json({ error: "Missing organization" }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
    }

    const formData = await req.formData();
    const entry = formData.get("file") ?? formData.get("invoice");
    if (!(entry instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (!entry.size) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    if (entry.size > MAX_INVOICE_PDF_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const mimeType = (entry.type || "").toLowerCase();
    const name = entry.name || "";
    const hasPdfMime = mimeType === "application/pdf" || mimeType === "application/x-pdf";
    const hasPdfExtension = name.toLowerCase().endsWith(".pdf");
    if (mimeType && !hasPdfMime) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 415 });
    }
    if (!mimeType && !hasPdfExtension) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 415 });
    }

    const arrayBuffer = await entry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      const result = await parseInvoicePdf(buffer);
      return NextResponse.json(result);
    } catch (error) {
      console.error("Failed to parse invoice PDF", error);
      return NextResponse.json({ error: "Could not extract invoice data" }, { status: 422 });
    }
  } catch (error) {
    console.error("Invoice extract handler error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
