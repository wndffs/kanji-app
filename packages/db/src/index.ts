export { Prisma, PrismaClient } from "@prisma/client";

export const DB_PACKAGE_NAME = "@kanji-srs/db";

export type DatabaseConnectionConfig = {
  databaseUrl: string;
};

export function createDatabaseConnectionConfig(databaseUrl: string): DatabaseConnectionConfig {
  return { databaseUrl };
}
