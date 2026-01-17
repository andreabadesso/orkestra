import type { PrismaClient } from '@prisma/client';

const config = {
  datasources: {
    db: {
      url:
        process.env['DATABASE_URL'] ||
        'postgresql://orkestra:orkestra_dev@localhost:5432/orkestra_dev',
    },
  },
};

export default config;

export type Config = typeof config;
