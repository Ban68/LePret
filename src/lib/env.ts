import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  const missing = Object.keys(_env.error.flatten().fieldErrors)
    .map((key) => `${key}`)
    .join(', ');
  console.error('❌ Invalid environment variables:', _env.error.flatten().fieldErrors);
  throw new Error(`Missing environment variables: ${missing}`);
}

export const env = _env.data;
