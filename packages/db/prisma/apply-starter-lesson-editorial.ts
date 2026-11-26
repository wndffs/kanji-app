import { PrismaClient } from "@prisma/client";

import { applyStarterLessonEditorial } from "../src/apply-starter-lesson-editorial";

const mode = process.argv[2];
if ((mode !== "plan" && mode !== "apply") || process.argv.length !== 3) {
  throw new Error("Usage: apply-starter-lesson-editorial.ts plan|apply");
}

const prisma = new PrismaClient();
try {
  console.log(JSON.stringify(await applyStarterLessonEditorial(prisma, mode)));
} finally {
  await prisma.$disconnect();
}
