# Foundation Wave 07 Review Proposal

Tasks 377-382 prepare the existing draft07, not a new imported or published
course. Proposed volume: 9 components at level 8, 10 kanji at level 9, 20
expression-reading pairs at level 10, 20 bilingual original examples and 69
cards. The ordering is project-authored and independent of third-party courses.

The source files are `editorial-draft-kanji-07.ts` and
`editorial-draft-words-07.ts`. They remain outside curator registries. Neither
reviewedAt nor any sealed published checksum is changed. No source ID will be
filled from a guessed match. This document is a proposal/checklist, not an
independent editor's approval or permission to publish.

No complete source snapshot was found under data/raw. Existing parser fixtures
cannot attest all candidates. Resolve exact KANJIDIC2 readings, KanjiVG paths
and exact JMdict expression-reading identities from a licensed local snapshot
or the existing read-only evidence inspection before any future publication.

## Russian Editorial Decisions

Retain the independently project-authored proposals, not imported Russian
glosses. 校/学校 use школа, 校長 uses директор школы; a generic директор would
lose the school restriction. 中学校 remains средняя школа первой ступени, not
старшая школа. 兄/姉 explicitly retain старший/старшая, and 弟/妹 retain
младший/младшая; generic брат/сестра must not erase the contrast. 兄弟 uses
братья и сёстры; 姉妹 uses сёстры. 父/母 as words describe one's own parents
in the proposed examples, without making a general politeness rule for every
context. 今/今日/今年 distinguish сейчас, сегодня and этот год. 何人/なんにん
asks сколько человек, not nationality. These are editorial proposals, not new
runtime accepted answers.

The Russian gate requires every meaning, mnemonic, hint, component shape/name
and example translation; primary meanings must occur in nonempty, normalized,
duplicate-free accepted sets. Family-age contrasts are explicitly tested.
Passing these mechanical checks does not establish translation quality or
independent review. An independent editor still needs to review all 39 items
and 20 examples before promotion.

## English Editorial Decisions

The English side preserves the same sense boundaries: school principal, not
generic director; elementary school versus junior high school; older/younger
brother and older/younger sister; siblings versus sisters. Now, today and this
year stay separate. How many people is not what nationality. English examples
are original companion translations, not copied dictionary example sentences.
No additional languages are included.

Both locale gates run independently. Neither locale can compensate for missing
fields in the other. A complete English row must not hide absent Russian text,
or vice versa. Script checks catch obvious swapped primary meanings, not every
language or translation error. Passing is preparation only, not approval.

## Reading Decisions

The ten kanji select on readings from their proposals; the twenty words test
whole-word readings. Do not transfer a kanji reading directly to a word card.
Examples needing explicit attention include 学校/がっこう (sokuon), 兄弟/きょうだい
(different on readings), 今日/きょう and 今年/ことし (whole-word reading), and
何人/なんにん (counting people, not なにじん). 父/母 words use ちち/はは while
their kanji cards select ふ/ぼ. No new accepted alternative is inferred from a
dictionary list or mechanical character concatenation.

The reading gate requires canonical hiragana (allowing the long-vowel mark),
unique alternatives and inclusion of each kanji primary in its accepted set.
Proposed KANJIDIC2 source spellings must normalize to the chosen kana. This is
internal consistency only: exact source attestation and source priority still
need the real licensed snapshot. Example readings also require editorial
checking for particles, counters and natural pronunciation.

## Placement And Provenance

Components precede their dependent kanji, and all kanji used in words or their
example sentences must be in earlier levels. Slots are checked against the
existing local registry as well as within this wave; duplicate expression-reading
pairs and component keys are not silently merged. This validates project order,
not a competitor's curriculum. No old sealed batch is edited.

Publication remains blocked until exact source identities, successful import
runs, licenses, URLs, versions, checksums and attributions are verified through
the existing source-evidence/curator preflight. JMdict multilingual terms must
be retained; project-authored meanings are not a substitute for dictionary
identity. KanjiVG assets retain their own attribution/share-alike requirements.
The twenty word source IDs intentionally remain null. Registry isolation and
nonpublication are tested; this wave never becomes a curator input merely by
passing a structural check.

## Aggregate Report

Run `npm run content:wave` for deterministic aggregate preparation counts.
It does not read DATABASE_URL or connect to Neon, download files, mutate data,
emit source records or publish anything. `npm run content:wave -- --require-ready`
fails deliberately while independent review/source evidence/publication approval
are absent. A successful default command means only structural validation passed.
Actual published counts are obtained separately from the authenticated course
coverage endpoint, never inferred from these source files.

2026-10-28 local result: structurallyValid=true; RU and EN each have zero
missing fields, invalid accepted sets, age-contrast failures or swapped-script
primary meanings. All 30 primary readings passed with zero additional accepted
readings. Placement issues: zero. All 20 JMdict IDs remain unresolved; source
evidence, independent review and publication authorization remain blockers.
ReadyToPublish=false. Reviewed registry totals remain 79 components, 101 kanji,
120 word pairs and 300 items; the long-term reviewed backlog remains 2199 kanji
and 7880 word pairs. None of these numbers is claimed as a fresh Neon audit.
