import { PrismaClient } from "@prisma/client";

import {
  applyFoundationKanjiEditorial,
  applyStarterLessonEditorial,
} from "../src/apply-starter-lesson-editorial";

const mode = process.argv[2];
const batch = process.argv[3] ?? "starter";
if (
  (mode !== "plan" && mode !== "apply") ||
  (batch !== "starter" && batch !== "foundation") ||
  process.argv.length > 4
) {
  throw new Error("Usage: apply-starter-lesson-editorial.ts plan|apply [starter|foundation]");
}

const prisma = new PrismaClient();
try {
  const run = batch === "starter" ? applyStarterLessonEditorial : applyFoundationKanjiEditorial;
  console.log(JSON.stringify(await run(prisma, mode)));
} finally {
  await prisma.$disconnect();
}
