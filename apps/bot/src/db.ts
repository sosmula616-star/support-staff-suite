import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.DEBUG ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

/** Находит саппорта или создаёт запись при первом обращении. */
export async function ensureSupport(id: string, username: string) {
  return prisma.supportUser.upsert({
    where: { id },
    update: { username },
    create: { id, username },
  });
}
