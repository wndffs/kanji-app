# Private Text Mining: Boundaries and Decision

## Audit (Task 482)

The old path emits every Japanese substring up to eight codepoints, then queries
100 candidates at a time. At 10,000 characters this can approach 80,000 distinct
candidates before `maxItems` applies. It matches spelling, not context or lemma;
frequency/item-ID tie breaks do not disambiguate a reading. Substring counts
are not linguistic token coverage. A small final cap can exclude prerequisites
even though the existing lesson queue correctly keeps the word locked.

Saved deck membership already uses canonical learning-item IDs and a unique
deck/item constraint. Owner checks exist on reads, status changes and lesson
launch. There is no reason to clone cards, alter global meanings or reset SRS
when changing a private selection.

## Local Analyzer Decision (Task 483)

Use the runtime's proven ICU-backed `Intl.Segmenter` for word-boundary hints,
not a new hand-written morphological engine or an external service. Keep the
bounded exact-dictionary fallback explicit. Normalize width/combining forms for
lookup while retaining original source offsets. A missing/failed segmenter
must report fallback mode, never pretend successful linguistic analysis.

The local Node 22 / ICU 77.1 probe segments 学校 and 日本語 usefully, but does not
reliably recover 食べる from 食べました. Therefore no lemma, translation, pitch,
JLPT or complete-token-coverage claim is justified. Do not silently install a
large analyzer/dictionary or transmit private pasted text to another provider.
Evaluate such a dependency separately against inflection/ambiguity fixtures
and compatible analyzer/dictionary licenses if future acceptance requires it.

Primary references: [ECMA-402 Segmenter](https://tc39.es/ecma402/#sec-intl.segmenter)
and [Node internationalization](https://nodejs.org/api/intl.html). ICU support
is already part of the Node runtime; this decision adds no npm production
dependency or educational data license. Existing imported dictionary licenses
and publication gates still apply to each chosen teaching material.

## New Flow Acceptance

Read-only preview precedes creation; the owner can correct or exclude exact
published matches. Creation revalidates selection against its submitted text.
Budgets limit candidates, ambiguous matches and dependency expansion before
writing; limits and externally required prerequisites are reported explicitly.
Request throttling is user-keyed. Dictionary additions/corrections modify only
private membership, transactionally, without changing global cards/answers or
SRS. Repeated additions are idempotent. Existing saved decks are not rebuilt
automatically and retain their source text.
