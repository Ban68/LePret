import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const offerSchema = z.object({
    annual_rate: z.number().min(0).max(100),
    advance_pct: z.number().min(0).max(100),
    fees: z.record(z.number().min(0)).optional(),
    valid_until: z.string().optional(),
});

export async function POST(
    request: Request,
    { params }: { params: Promise<{ requestId: string }> }
) {
    try {
        const { requestId } = await params;
        const body = await request.json();
        const payload = offerSchema.parse(body);

        const supabase = createRouteHandlerClient({ cookies });
        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Verify Staff permissions
        const { data: profile } = await supabase
            .from("profiles")
            .select("is_staff")
            .eq("user_id", session.user.id)
            .single();

        if (!profile?.is_staff) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // 2. Get Request context
        const { data: reqData, error: reqError } = await supabase
            .from("funding_requests")
            .select("id, company_id, status")
            .eq("id", requestId)
            .single();

        if (reqError || !reqData) {
            return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
        }

        // 3. Upsert Offer
        // Check if offer exists
        const { data: existingOffer } = await supabase
            .from("offers")
            .select("id")
            .eq("request_id", requestId)
            .eq("status", "offered")
            .maybeSingle();

        let offerId = existingOffer?.id;
        let action = "updated";

        const offerData = {
            company_id: reqData.company_id,
            request_id: requestId,
            annual_rate: payload.annual_rate,
            advance_pct: payload.advance_pct,
            fees: payload.fees || {},
            valid_until: payload.valid_until || null,
            created_by: session.user.id,
            status: "offered",
        };

        if (offerId) {
            const { error: updateError } = await supabase
                .from("offers")
                .update(offerData)
                .eq("id", offerId);
            if (updateError) throw updateError;
        } else {
            action = "created";
            const { data: newOffer, error: insertError } = await supabase
                .from("offers")
                .insert(offerData)
                .select("id")
                .single();
            if (insertError) throw insertError;
            offerId = newOffer.id;
        }

        // 4. Update Request Status to 'offered' if needed
        if (reqData.status !== "offered") {
            await supabase
                .from("funding_requests")
                .update({ status: "offered" })
                .eq("id", requestId);

            // Log status change event
            await supabase.from("request_events").insert({
                request_id: requestId,
                company_id: reqData.company_id,
                event_type: "status_change",
                status: "offered",
                title: "Oferta generada",
                description: "Se ha generado una oferta para esta solicitud.",
                actor_role: "staff",
                actor_id: session.user.id,
            });
        }

        // 5. Log audit
        await supabase.from("audit_logs").insert({
            company_id: reqData.company_id,
            actor_id: session.user.id,
            entity: "offer",
            entity_id: offerId,
            action: action,
            data: payload,
        });

        return NextResponse.json({ ok: true, offerId, action });
    } catch (error) {
        console.error("Error creating offer:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Datos inválidos", details: error.errors }, { status: 400 });
        }
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
