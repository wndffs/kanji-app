# Course content quality

Task 119's deterministic rules live in `packages/db/src/content-quality.ts`.
The Prisma reader and bounded report live in `content-quality-report.ts`.
Both the admin API and CLI use these same rules. Answer normalization and
sample acceptance reuse `packages/japanese`; course bands reuse the independent
60-level blueprint. There are no additional external production dependencies.

`course-content-quality-v2` adds direct word-example provenance, bounded
eligibility and invalid-published-example checks. The policy participates in
the content hash, so v1 reports/confirmation hashes are not interchangeable
with v2 even when placement counts are identical. Historical v1 evidence
remains historical; the next publication must recompute v2.

## Run

With `DATABASE_URL` supplied securely, run:

```bash
npm run content:quality -- --output /tmp/course-quality.json
```

The command exits nonzero for blockers. `--report-only` writes a diagnostic
report without failing on editorial gaps. It runs in a repeatable-read snapshot,
reads at most 100 learning items per page, retains at most 1,000 issue details,
and counts every issue. The content checksum includes every inspected item and
does not depend on report time or the retained issue sample. It is not a raw
corpus-size report: only published placements in the main course are audited.

## Checks and publication

The versioned codes cover missing targets/cards, empty or duplicate answers,
normalization drift, one primary meaning per language, blocked-answer
collisions, unsupported source readings/locales, unreviewed imported answers,
source metadata, bilingual mnemonics, placeholders, stroke provenance, word
part-of-speech evidence, examples, media, prerequisite coverage/status/type/
order, graph cycles, and unique in-blueprint placement.

Missing examples currently block publication; no automatic editorial waiver is
invented. The checker detects structural/source gaps, not semantic translation
accuracy. Independent bilingual editorial review remains required.

Publication readiness v2 includes a content-quality check and content checksum.
The actual publication transaction recalculates the report before writing, so
editing content invalidates an older confirmation even when item counts stay
unchanged. Allocation and enrollment remain separate operations. Existing
eight-check v1 fixtures are retained only for compatibility tests.

Admins can inspect `GET /admin/curriculum/content-quality?limit=50&cursor=<uuid>`
and filter returned issues with `code=<versioned-code>`. The page reads a bounded
item window; an empty filtered page can still have a continuation cursor. The
admin screen loads these pages only on request and links each issue back to
curation. A full-course report is the authority for total counts.

## Verification boundary

Focused tests cover every issue code, valid content, normalized blocked answers,
real blueprint ranges, keyset continuation, bounded issue retention, stable
checksums, input validation, publication invalidation, and admin pagination.
Full-scale staging verification depends on Task 118's published corpus and
database availability. Never substitute fixture results for that evidence.
