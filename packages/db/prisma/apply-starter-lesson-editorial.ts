import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";

import {
  applyFoundationBasicsEditorial,
  applyFoundationCompletionEditorial,
  applyFoundationLevelEightEditorial,
  applyFoundationLevelElevenEditorial,
  applyFoundationComponentsEditorial,
  applyFoundationKanjiEditorial,
  applyFoundationLevelFiveEditorial,
  applyFoundationLevelFourEditorial,
  applyFoundationLevelNineEditorial,
  applyFoundationLevelSevenEditorial,
  applyFoundationLevelSixEditorial,
  applyFoundationLevelTenEditorial,
  applyFoundationLevelThreeEditorial,
  applyFoundationLevelTwelveEditorial,
  applyStarterLessonEditorial,
  resolveEditorialBatch,
  shouldRetryEditorialPlan,
} from "../src/apply-starter-lesson-editorial";

const mode = process.argv[2];
const batch = resolveEditorialBatch(process.argv[3] ?? "starter");
if ((mode !== "plan" && mode !== "apply") || batch === undefined || process.argv.length > 4) {
  throw new Error(
    "Usage: apply-starter-lesson-editorial.ts plan|apply [registered batch or release tag]",
  );
}

const run = {
  starter: applyStarterLessonEditorial,
  foundation: applyFoundationKanjiEditorial,
  "foundation-basics": applyFoundationBasicsEditorial,
  "foundation-components": applyFoundationComponentsEditorial,
  "foundation-completion": applyFoundationCompletionEditorial,
  "foundation-level-three": applyFoundationLevelThreeEditorial,
  "foundation-level-four": applyFoundationLevelFourEditorial,
  "foundation-level-five": applyFoundationLevelFiveEditorial,
  "foundation-level-six": applyFoundationLevelSixEditorial,
  "foundation-level-seven": applyFoundationLevelSevenEditorial,
  "foundation-level-eight": applyFoundationLevelEightEditorial,
  "foundation-level-nine": applyFoundationLevelNineEditorial,
  "foundation-level-ten": applyFoundationLevelTenEditorial,
  "foundation-level-eleven": applyFoundationLevelElevenEditorial,
  "foundation-level-twelve": applyFoundationLevelTwelveEditorial,
}[batch];
for (let attempt = 1; ; attempt++) {
  const prisma = new PrismaClient();
  try {
    console.log(JSON.stringify(await run(prisma, mode)));
    break;
  } catch (error) {
    if (!shouldRetryEditorialPlan(mode, attempt, error)) throw error;
    console.warn("Neon was unreachable during the read-only plan; retrying.");
  } finally {
    await prisma.$disconnect();
  }
  await delay(attempt * 2_500);
}
