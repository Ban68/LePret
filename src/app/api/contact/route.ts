export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { ContactValidator } from '@/lib/validators/contact';
import { z } from 'zod';
import { Resend } from 'resend';
import sanitizeHtml from 'sanitize-html';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nombre, email, telefono, mensaje } = ContactValidator.parse(body);
    const safeNombre = sanitizeHtml(nombre);
    const safeEmail = sanitizeHtml(email);
    const safeTelefono = telefono ? sanitizeHtml(telefono) : undefined;
    const safeMensaje = sanitizeHtml(mensaje);

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: [safeEmail, 'admin@lepret.co'],
      subject: `Nuevo Mensaje de Contacto de ${safeNombre}`,
      html: `<p><strong>Nombre:</strong> ${safeNombre}</p>
             <p><strong>Email:</strong> ${safeEmail}</p>
             <p><strong>Teléfono:</strong> ${safeTelefono || 'No proporcionado'}</p>
             <p><strong>Mensaje:</strong></p>
             <p>${safeMensaje}</p>`
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
