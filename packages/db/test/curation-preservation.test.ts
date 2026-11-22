import { type Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  capturePreservationSnapshot,
  parsePreservationSnapshot,
  selectPreservationMode,
  summarizePreservation,
} from "../prisma/check-curation-preservation";

const groups = [
  "User",
  "UserSettings",
  "UserEnrollment",
  "UserSrsState",
  "ReviewSession",
  "ReviewAnswer",
  "UserItemOverride",
  "UserMnemonic",
  "UserCourseLevelCompletion",
  "UserUnlockEvent",
  "UserKanaProgress",
  "KanaPracticeSession",
  "KanaAttempt",
  "Deck",
  "DeckItem",
  "Course",
  "CourseLevel",
  "PublishedCoursePlacement",
];
const testHash = "a".repeat(32);
const raw = groups.map((group) => ({ group, rows: 10, hash: testHash }));

describe("course release preservation", () => {
  it("captures only bounded, sorted fingerprints in a single database read", async () => {
    const query = vi.fn().mockResolvedValue(raw);
    const snapshot = await capturePreservationSnapshot({ $queryRaw: query } as unknown as Pick<
      PrismaClient,
      "$queryRaw"
    >);
    expect(snapshot).toEqual(raw);
    expect(query).toHaveBeenCalledOnce();
    const statement = query.mock.calls[0]![0] as Prisma.Sql;
    expect(statement.sql).toContain(`to_jsonb(r) - 'passwordHash' - 'email'`);
    expect(statement.sql).toContain(
      `JOIN "Course" c ON c.id = l."courseId" WHERE c.status = 'PUBLISHED'`,
    );
    expect(statement.sql.match(/ORDER BY r\.id LIMIT/g)).toHaveLength(groups.length);
    expect(statement.values.filter((value) => value === 200_001)).toHaveLength(groups.length);
    expect(statement.sql.match(/UNION ALL/g)).toHaveLength(groups.length - 1);
  });

  it("distinguishes same-count learner drift from curriculum drift without exposing hashes or rows", () => {
    const before = parsePreservationSnapshot(raw);
    const after = parsePreservationSnapshot(
      raw
        .map((row) => {
          if (row.group === "UserSrsState" || row.group === "CourseLevel")
            return { ...row, hash: "b".repeat(32) };
          if (row.group === "ReviewSession") return { ...row, rows: 200_001 };
          return row;
        })
        .reverse(),
    );
    const report = summarizePreservation(before, after);
    expect(report).toEqual({
      learnerData: { unchanged: 13, changed: 1, beyondLimit: 1 },
      curriculum: { unchanged: 2, changed: 1, beyondLimit: 0 },
    });
    expect(JSON.stringify(report)).not.toContain(testHash);
    expect(JSON.stringify(report)).not.toContain("UserSrsState");
  });

  it("rejects invalid modes, duplicate groups and incomplete baselines", () => {
    expect(selectPreservationMode(["capture"])).toBe("capture");
    expect(selectPreservationMode(["compare"])).toBe("compare");
    expect(() => selectPreservationMode(["compare", "other-file"])).toThrow();
    for (const input of [
      raw.slice(1),
      [raw[1], ...raw.slice(1)],
      [{ ...raw[0], hash: "malformed" }, ...raw.slice(1)],
      [{ ...raw[0], rows: 200_002 }, ...raw.slice(1)],
    ])
      expect(() => parsePreservationSnapshot(input)).toThrow("Invalid preservation snapshot");
  });
});
