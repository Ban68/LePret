import { z } from 'zod';

export const PreapprovalValidator = z.object({
  nit: z.string().min(5, "NIT inválido"),
  razonSocial: z.string().optional().default(""),
  ventasAnuales: z.coerce.number().positive("Ingresa un valor válido"),
  facturasMes: z.coerce.number().int().nonnegative("Ingresa un entero válido"),
  ticketPromedio: z.coerce.number().positive("Ingresa un valor válido"),
  email: z.string().email("Email inválido"),
  telefono: z.string().optional(),
  consent: z.boolean().refine((val) => val === true, { message: "Debes aceptar la política de datos" }),
});

export type PreapprovalFormValues = z.infer<typeof PreapprovalValidator>;
