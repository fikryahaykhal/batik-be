import { PrismaClient } from "@prisma/client";

/**
 * Satu instance Prisma di dev (tsx watch / HMR) supaya tidak menumpuk koneksi SQLite
 * yang bisa mengunci DB atau membuat server berhenti merespons.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
