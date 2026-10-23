import { buildEditorialCoverage } from "../src/editorial-coverage";

if (process.argv.length !== 2) {
  console.error("Editorial coverage accepts no flags and never uses a database.");
  process.exitCode = 1;
} else {
  const report = buildEditorialCoverage();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.validation.valid ? 0 : 1;
}
