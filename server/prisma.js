require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../prisma/generated-client');

/**
 * Shared Prisma client instance.
 * Using globalThis guard in development to avoid leaking clients during hot reloads or multiple imports.
 * Prisma 7 requires a driver adapter for PostgreSQL.
 */
let prisma;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({ adapter });
} else {
  // In development, attach the client to globalThis to preserve the same instance
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      adapter,
      log: ['query', 'error', 'warn'],
    });
  }
  prisma = global.prisma;
}

module.exports = prisma;
