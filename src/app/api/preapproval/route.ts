import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PreapprovalValidator } from '@/lib/validators/preapproval';
import { z } from 'zod';

// Dummy business logic for credit line estimation
function calculateCupo(ventasAnuales: number, ticketPromedio: number, facturasMes: number): number {
    const cupoPorVentas = ventasAnuales * 0.1; // 10% of annual sales
    const cupoPorTicket = ticketPromedio * 10; // 10x average ticket
    const factorFacturas = Math.min(facturasMes / 20, 1.5); // Multiplier based on invoice volume, capped at 1.5

    const cupoBase = Math.min(cupoPorVentas, cupoPorTicket);
    const cupoEstimado = cupoBase * factorFacturas;

    // Round to nearest 1,000,000
    return Math.round(cupoEstimado / 1000000) * 1000000;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validatedData = PreapprovalValidator.parse(body);

    const { nit, razonSocial, ventasAnuales, facturasMes, ticketPromedio, email, telefono, consent } = validatedData;

    // Check if a lead with this NIT already exists
    const existingLead = await prisma.lead.findFirst({
        where: { nit },
    });

    if (existingLead) {
        return new NextResponse(
            JSON.stringify({ message: 'Ya existe una solicitud con este NIT.' }),
            { status: 409 }
        );
    }

    const cupoEstimado = calculateCupo(ventasAnuales, ticketPromedio, facturasMes);

    const newLead = await prisma.lead.create({
      data: {
        nit,
        razonSocial,
        email,
        telefono,
        ventasAnuales,
        facturasMes,
        ticketPromedio,
        consent,
        source: 'web',
        preapproval: {
          create: {
            cupoEstimado,
            status: 'ESTIMADO',
          },
        },
      },
      include: {
        preapproval: true,
      },
    });

    // TODO: Send email notifications via Resend

    return NextResponse.json({
      cupoEstimado,
      message: '¡Preaprobación exitosa!',
      nextSteps: 'Un asesor se pondrá en contacto contigo para los siguientes pasos.',
      leadId: newLead.id,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify({ errors: error.issues }), { status: 422 });
    }

    console.error(error);
    return new NextResponse(
      JSON.stringify({ message: 'Ocurrió un error en el servidor.' }),
      { status: 500 }
    );
  }
}
