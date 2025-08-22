import { PrismaClient } from '@prisma/client';
import { env } from '@/lib/env';

declare global {
  // allow global `var` declarations
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query'] : [],
  });

if (env.NODE_ENV !== 'production') global.prisma = prisma;
