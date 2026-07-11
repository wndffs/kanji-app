DROP INDEX "KanjiMeaning_kanjiId_locale_meaning_key";

CREATE UNIQUE INDEX "KanjiMeaning_kanjiId_locale_meaning_sourceKind_key"
ON "KanjiMeaning"("kanjiId", "locale", "meaning", "sourceKind");
