import { planEditorialWave, nextEditorialWave, type EditorialWaveInput } from "./editorial-wave";
import { auditWaveLocale } from "./editorial-wave-language";
import { auditWaveReadings } from "./editorial-wave-readings";
import { auditWavePlacement } from "./editorial-wave-placement";
import { buildEditorialCoverage } from "./editorial-coverage";

export function buildEditorialWaveReport(input: EditorialWaveInput = nextEditorialWave()) {
  const plan = planEditorialWave(input);
  const ru = auditWaveLocale("ru", input); const en = auditWaveLocale("en", input);
  const readings = auditWaveReadings(input); const placement = auditWavePlacement(input);
  const registry = buildEditorialCoverage();
  return {
    ...plan,
    structurallyValid: ru.valid && en.valid && readings.valid && placement.valid,
    readyToPublish: false as const,
    checks: { ru, en, readings, placement },
    reviewedRegistry: registry.reviewedRegistry,
    remainingReviewedContent: registry.remainingReviewedContent,
    caveat: "Local source-only preparation, not a live publication audit, source attestation, independent review or approval. Drafts do not reduce the reviewed backlog.",
  };
}
