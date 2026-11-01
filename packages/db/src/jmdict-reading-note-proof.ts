import { createHash } from "node:crypto";

export type JmdictReadingNote = {
  readonly reading: string;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly sourceDocumentSha256: string;
  readonly note: string;
};
export type ReadingNoteWord = {
  readonly expression: string;
  readonly reading: string;
  readonly jmdictEntryId: string;
  readonly sourceNoteReadings?: readonly JmdictReadingNote[];
};

export function readingNoteProofData(word: ReadingNoteWord, note: JmdictReadingNote) {
  return {
    proofKind: "JMDICT_SENSE_NOTE" as const,
    schemaVersion: 1 as const,
    sequence: note.sourceRecordId.slice(7),
    expression: word.expression,
    primaryReading: word.reading,
    reading: note.reading,
    sourceVersion: note.sourceVersion,
    sourceDocumentSha256: note.sourceDocumentSha256,
    note: note.note,
  };
}
export function readingNoteProofChecksum(word: ReadingNoteWord, note: JmdictReadingNote) {
  return createHash("sha256")
    .update(JSON.stringify(readingNoteProofData(word, note)), "utf8")
    .digest("hex");
}
export function validReadingNote(word: ReadingNoteWord, note: JmdictReadingNote) {
  return (
    /^[ぁ-ゖー]+$/u.test(note.reading) &&
    note.reading !== word.reading &&
    note.sourceRecordId === word.jmdictEntryId &&
    /^jmdict:[1-9]\d*$/u.test(note.sourceRecordId) &&
    /^\d{4}-\d{2}-\d{2}$/u.test(note.sourceVersion) &&
    /^[a-f0-9]{64}$/u.test(note.sourceDocumentSha256) &&
    note.note === `also ${note.reading} (all senses)` &&
    note.note.length <= 1000
  );
}
