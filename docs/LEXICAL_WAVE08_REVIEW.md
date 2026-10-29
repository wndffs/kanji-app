# Lexical Wave08 Editorial Review

2026-10-29. Thirty candidates were matched against the existing verified local
JMdict snapshot. Twenty are selected under the unchanged 20-word batch limit:
ten verbs, five i-adjectives and five nouns. All selected exact source IDs and
both source locales match. 前's selected ゼン/ぜん and primary graphic also
match KANJIDIC2/KanjiVG. Detailed dictionary observations remain outside Git.

Independent AI reviewer Pasteur checked every RU/EN meaning, accepted/blocked
set, example and metadata class. Initial approval was blocked by scope and
accepted-answer issues. Parent corrections align 午後's bilingual primary sense,
accept morning/утро while explaining a.m., add look at/listen to and кличка,
remove the overbroad bare правый hard block, correct translations and avoid an
absolute speaker-relative rule for 行く. The second review approved all twenty
entries, with two final wording nits integrated. Explicit suggested antianswers
сидеть/smell/night were already rejected by the current validator without new
blocks; their presence is a semantic boundary, not a reproduced fuzzy bug fix.

Independent AI reviewer Pascal checked 前's visual cues against KanjiVG and
the selected reading against KANJIDIC2, all twenty word readings and all kana
transcriptions. Corrections distinguish okurigana from inflection, acknowledge
the real same-word にっぽんご variant outside selected scope, and separate the
five morae in が・い・こ・く・ご. Follow-up review confirmed these corrections.

The two reviewers approved educational content as AI review only; they did not
certify human review, database safety, publication, independent test execution,
or externally proven originality. Source matching, review and live operator
acceptance are separate gates. No competitor educational content was used.

`lexical-wave08-review.ts` binds the final kanji/word payload SHA-256 values to
the observed source/candidate fingerprints. It explicitly does not grant
publication approval. Do not edit the sealed teaching payload after live
application; future corrections need an explicit versioned repair.
