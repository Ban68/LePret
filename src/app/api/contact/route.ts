export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { ContactValidator } from '@/lib/validators/contact';
import { z } from 'zod';
import { Resend } from 'resend';
import { env } from '@/lib/env';

const resend = new Resend(env.RESEND_API_KEY);

export async function POST(req: Request) {
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
