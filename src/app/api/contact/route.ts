export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { ContactValidator } from '@/lib/validators/contact';
import { z } from 'zod';
import { Resend } from 'resend';
import { isRateLimited } from '@/lib/ratelimit';
import { isValidOrigin } from '@/lib/security';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(ip)) {
    return new NextResponse(
      JSON.stringify({ message: 'Demasiadas solicitudes.' }),
      { status: 429 }
    );
  }

  if (!isValidOrigin(req)) {
    return new NextResponse(
      JSON.stringify({ message: 'Operación no permitida.' }),
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { nombre, email, telefono, mensaje } = ContactValidator.parse(body);

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: [email, 'admin@lepret.co'],
      subject: `Nuevo Mensaje de Contacto de ${nombre}`,
      html: `<p><strong>Nombre:</strong> ${nombre}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Teléfono:</strong> ${telefono || 'No proporcionado'}</p>
             <p><strong>Mensaje:</strong></p>
             <p>${mensaje}</p>`
    });

    return NextResponse.json({ message: 'Mensaje enviado con éxito. Nos pondremos en contacto contigo pronto.' });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify({ errors: error.issues }), { status: 422 });
    }

    console.error(error);
    return new NextResponse(
      JSON.stringify({ message: 'Ocurrió un error al enviar el correo.' }),
      { status: 500 }
    );
  }
}
