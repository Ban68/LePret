import { z } from 'zod';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export const InvoiceUploadValidator = z.object({
  invoiceNumber: z.string().min(1, 'El número de factura es requerido.'),
  amount: z.coerce.number().positive('El monto debe ser un número positivo.'),
  dueDate: z.coerce.date({ message: 'Por favor ingresa una fecha válida.' }),
  file: z
    .instanceof(File, { message: 'Por favor selecciona un archivo.' })
    .refine((file) => file.size <= MAX_FILE_SIZE, `El tamaño máximo del archivo es 5MB.`)
    .refine(
      (file) => ACCEPTED_FILE_TYPES.includes(file.type),
      'Solo se aceptan archivos PDF, JPG o PNG.'
    ),
});

export type InvoiceUploadRequest = z.infer<typeof InvoiceUploadValidator>;

// Define the input type for the form before Zod coercion
export type InvoiceUploadFormInput = {
  invoiceNumber: string;
  amount: string | number; // Input can be string from form field
  dueDate: string | Date; // Input can be string from form field
  file: File | undefined; // Input can be undefined if no file is selected
};
