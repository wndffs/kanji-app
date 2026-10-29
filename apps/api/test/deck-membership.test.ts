import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PrismaDecksRepository } from "../src/decks/decks.repository";
import type { PrismaService } from "../src/database/prisma.service";
import { DecksController } from "../src/decks/decks.controller";
import type { DecksService } from "../src/decks/decks.service";
import type { CurrentUserDto } from "../src/auth/auth.types";
import { RateLimitService } from "../src/security/rate-limit.service";

const owner = "00000000-0000-4000-8000-000000000001";
const deck = "00000000-0000-4000-8000-000000000002";
const item = "00000000-0000-4000-8000-000000000003";

function fixture(status = "ACTIVE", exists = true) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue(exists ? [{ id: deck, status }] : []),
    learningItem: { findMany: vi.fn().mockResolvedValue([{ id: item }]) },
    deckItem: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    deck: { update: vi.fn().mockResolvedValue({ id: deck }) },
  };
  const db = { $transaction: vi.fn(async (run: (value: typeof tx) => unknown) => run(tx)) };
  const repository = new PrismaDecksRepository({ db } as unknown as PrismaService);
  vi.spyOn(repository, "findDeckForOwner").mockResolvedValue(null);
  return { tx, repository };
}

describe("serialized private deck membership", () => {
  it("throttles mining per user before service work", () => {
    const service = { previewFromText: vi.fn() };
    const controller = new DecksController(
      service as unknown as DecksService,
      new RateLimitService(),
    );
    for (let count = 0; count < 12; count++)
      controller.previewFromText({ id: owner } as CurrentUserDto, { text: "学校" });
    expect(() =>
      controller.previewFromText({ id: owner } as CurrentUserDto, { text: "学校" }),
    ).toThrow("Too many");
    expect(service.previewFromText).toHaveBeenCalledTimes(12);
    controller.previewFromText({ id: "other" } as CurrentUserDto, { text: "学校" });
    expect(service.previewFromText).toHaveBeenCalledTimes(13);
  });
  it("rejects high-fanout prerequisites before target hydration", async () => {
    const dependency = {
      findMany: vi
        .fn()
        .mockResolvedValue(
          Array.from({ length: 513 }, (_, index) => ({
            learningItemId: item,
            prerequisiteItem: { id: String(index) },
          })),
        ),
    };
    const component = { findUnique: vi.fn() };
    const repository = new PrismaDecksRepository({
      db: { dependency, component },
    } as unknown as PrismaService);
    await expect(repository.findPrerequisites([item])).rejects.toBeInstanceOf(BadRequestException);
    expect(component.findUnique).not.toHaveBeenCalled();
  });
  it("locks the owner row before adding only published canonical references", async () => {
    const { tx, repository } = fixture();
    await repository.addItems(owner, deck, [item]);
    const sql = tx.$queryRaw.mock.calls[0]![0] as { sql: string; values: unknown[] };
    expect(sql.sql).toContain('"ownerUserId"');
    expect(sql.sql).toContain("FOR UPDATE");
    expect(sql.values).toEqual([deck, owner]);
    expect(tx.learningItem.findMany).toHaveBeenCalledWith({
      where: { id: { in: [item] }, status: "PUBLISHED" },
      select: { id: true },
    });
    expect(tx.deckItem.createMany).toHaveBeenCalledWith({
      data: [{ deckId: deck, learningItemId: item, sortOrder: 1, reasonJson: [] }],
      skipDuplicates: true,
    });
    expect(repository.findDeckForOwner).toHaveBeenCalledWith(owner, deck);
  });
  it("does not query targets or mutate another owner's deck", async () => {
    const { tx, repository } = fixture("ACTIVE", false);
    expect(await repository.addItems(owner, deck, [item])).toBeNull();
    expect(tx.learningItem.findMany).not.toHaveBeenCalled();
    expect(tx.deckItem.createMany).not.toHaveBeenCalled();
  });
  it("rejects archived/unpublished targets and makes repeated additions no-ops", async () => {
    const archived = fixture("ARCHIVED");
    await expect(archived.repository.addItems(owner, deck, [item])).rejects.toBeInstanceOf(
      ConflictException,
    );
    const { tx, repository } = fixture();
    tx.learningItem.findMany.mockResolvedValueOnce([]);
    await expect(repository.addItems(owner, deck, [item])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    tx.deckItem.findMany.mockResolvedValueOnce([{ learningItemId: item, sortOrder: 7 }] as never);
    await repository.addItems(owner, deck, [item]);
    expect(tx.deckItem.createMany).not.toHaveBeenCalled();
    expect(tx.deck.update).not.toHaveBeenCalled();
  });
  it("removes only membership under the same lock, without touching progress", async () => {
    const { tx, repository } = fixture();
    await repository.removeItem(owner, deck, item);
    expect(tx.deckItem.deleteMany).toHaveBeenCalledWith({
      where: { deckId: deck, learningItemId: item },
    });
    expect(tx.learningItem.findMany).not.toHaveBeenCalled();
  });
});
