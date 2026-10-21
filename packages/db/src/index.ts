export { Prisma, PrismaClient } from "@prisma/client";

export const DB_PACKAGE_NAME = "@kanji-srs/db";

export * from "./course-level-policy";
export * from "./course-seed";
export * from "./main-course-content";
export * from "./main-course";
export * from "./content-quality";
export * from "./content-quality-report";
export * from "./connection-defaults";

export type DatabaseConnectionConfig = {
  databaseUrl: string;
};

export function createDatabaseConnectionConfig(databaseUrl: string): DatabaseConnectionConfig {
  return { databaseUrl };
}
