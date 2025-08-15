import { z } from 'zod';

export const PreapprovalValidator = z.object({
  nit: z.string().min(1, "El NIT es requerido."),
  razonSocial: z.string().optional(),
  ventasAnuales: z.coerce.number().min(1, "Las ventas anuales son requeridas."),
  facturasMes: z.coerce.number().min(1, "El número de facturas es requerido."),
  ticketPromedio: z.coerce.number().min(1, "El ticket promedio es requerido."),
  email: z.string().email("Email inválido."),
  telefono: z.string().optional(),
  consent: z.boolean().refine(val => val === true, "Debes aceptar la política de tratamiento de datos."),
});

export type PreapprovalRequest = z.infer<typeof PreapprovalValidator>;
