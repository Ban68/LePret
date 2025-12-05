import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ offerId: string }> }
) {
    try {
        const { offerId } = await params;

        const supabase = createRouteHandlerClient({ cookies });
        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Get Offer and Request
        const { data: offer, error: offerError } = await supabase
            .from("offers")
            .select("*, funding_requests(id, status, company_id)")
            .eq("id", offerId)
            .single();

        if (offerError || !offer) {
            return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });
        }

        if (offer.status !== "offered") {
            return NextResponse.json({ error: "Esta oferta no está disponible para rechazo" }, { status: 400 });
        }

        // 2. Verify Permissions
        const { data: membership } = await supabase
            .from("memberships")
            .select("role, status")
            .eq("company_id", offer.company_id)
            .eq("user_id", session.user.id)
            .eq("status", "ACTIVE")
            .single();

        const allowedRoles = ["OWNER", "ADMIN", "OWNER_ORG", "ADMIN_ORG"];
        const isAuthorized = membership && allowedRoles.includes(membership.role.toUpperCase());

        if (!isAuthorized) {
            const { data: profile } = await supabase.from("profiles").select("is_staff").eq("user_id", session.user.id).single();
            if (!profile?.is_staff) {
                return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
            }
        }

        // 3. Update Offer Status
        const { error: updateOfferError } = await supabase
            .from("offers")
            .update({
                status: "cancelled", // or rejected
            })
            .eq("id", offerId);

        if (updateOfferError) throw updateOfferError;

        // 4. Update Request Status ? Maybe back to review? Or rejected?
        // Usually if client rejects, it might go back to review or just stay as is but with offer cancelled.
        // Let's set request back to 'review' so staff can offer again or discuss.
        await supabase
            .from("funding_requests")
            .update({ status: "review" })
            .eq("id", offer.request_id);

        // 5. Log Event
        await supabase.from("request_events").insert({
            request_id: offer.request_id,
            company_id: offer.company_id,
            event_type: "status_change",
            status: "review",
            title: "Oferta rechazada",
            description: "El cliente ha rechazado la oferta.",
            actor_role: "client",
            actor_id: session.user.id,
        });

        // 6. Audit
        await supabase.from("audit_logs").insert({
            company_id: offer.company_id,
            actor_id: session.user.id,
            entity: "offer",
            entity_id: offerId,
            action: "rejected",
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error rejecting offer:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
