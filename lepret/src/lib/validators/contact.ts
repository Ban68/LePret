import { z } from 'zod';

export const ContactValidator = z.object({
  nombre: z.string().min(2, "El nombre es muy corto."),
  email: z.string().email("Email inválido."),
  telefono: z.string().optional(),
  mensaje: z.string().min(10, "El mensaje es muy corto."),
});

export type ContactRequest = z.infer<typeof ContactValidator>;
