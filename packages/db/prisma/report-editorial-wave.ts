import { buildEditorialWaveReport } from "../src/editorial-wave-report";

if (process.argv.slice(2).some((argument) => argument !== "--require-ready")) {
  throw new Error("Only --require-ready is supported. This command never connects to a database.");
}
const report = buildEditorialWaveReport();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.structurallyValid || process.argv.includes("--require-ready")) process.exitCode = 1;
