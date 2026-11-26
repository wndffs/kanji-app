import { PrismaClient } from "@prisma/client";

import {
  applyFoundationBasicsEditorial,
  applyFoundationKanjiEditorial,
  applyStarterLessonEditorial,
  resolveEditorialBatch,
} from "../src/apply-starter-lesson-editorial";

const mode = process.argv[2];
const batch = resolveEditorialBatch(process.argv[3] ?? "starter");
if ((mode !== "plan" && mode !== "apply") || batch === undefined || process.argv.length > 4) {
  throw new Error(
    "Usage: apply-starter-lesson-editorial.ts plan|apply [registered batch or release tag]",
  );
}

const prisma = new PrismaClient();
try {
  const run = {
    starter: applyStarterLessonEditorial,
    foundation: applyFoundationKanjiEditorial,
    "foundation-basics": applyFoundationBasicsEditorial,
  }[batch];
  console.log(JSON.stringify(await run(prisma, mode)));
} finally {
  await prisma.$disconnect();
}
