import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma client in development
declare global {
  // eslint-disable-next-line no-var
  var __db: PrismaClient | undefined;
}

let db: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  // In production, always create a new client
  db = new PrismaClient();
} else {
  // In development, use global singleton to prevent too many connections
  if (!global.__db) {
    global.__db = new PrismaClient();
  }
  db = global.__db;
}

export { db };