import { PrismaClient } from '@prisma/client';

declare global {
  var __diotestPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__diotestPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__diotestPrisma = prisma;
}
