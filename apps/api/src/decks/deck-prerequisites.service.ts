import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  satisfiesCardPrerequisite,
  type CreatePrerequisiteDeckResponse,
  type DeckPrerequisitePlanDto,
} from "@kanji-srs/shared";

import { LessonsRepository } from "../lessons/lessons.repository";
import { type LessonEligibilityItemRecord } from "../lessons/lessons.types";
import { DecksRepository } from "./decks.repository";

const MAX_GRAPH_ITEMS = 512;
const MAX_GRAPH_DEPTH = 16;
const MAX_FOLLOWUP_ITEMS = 160;

@Injectable()
export class DeckPrerequisitesService {
  constructor(
    @Inject(LessonsRepository) private readonly lessons: LessonsRepository,
    @Inject(DecksRepository) private readonly decks: DecksRepository,
  ) {}

  async preview(userId: string, deckId: string): Promise<DeckPrerequisitePlanDto> {
    const plan = await this.plan(userId, deckId);
    const items = await this.lessons.loadLessonItems(
      userId,
      plan.ready.slice(0, 6).map(({ id }) => id),
    );
    return {
      readyCount: plan.ready.length,
      waitingReviewCount: plan.waitingReviewCount,
      incompleteProgressCount: plan.incompleteProgressCount,
      unavailableCount: plan.unavailableCount,
      preview: [...items.values()].map(({ id, target }) => ({ id, japanese: target.japanese })),
    };
  }

  async create(userId: string, deckId: string): Promise<CreatePrerequisiteDeckResponse> {
    const plan = await this.plan(userId, deckId);
    if (plan.ready.length === 0)
      throw new BadRequestException("Нет предпосылок, которые сейчас можно начать.");
    const deck = await this.decks.createTextDeck({
      ownerUserId: userId,
      title: `Предпосылки: ${plan.title}`.slice(0, 100),
      sourceText: null,
      items: plan.ready.slice(0, MAX_FOLLOWUP_ITEMS).map((entry, index) => ({
        learningItemId: entry.id,
        sortOrder: index + 1,
        reasons:
          entry.itemType === "component" || entry.itemType === "kanji"
            ? [
                {
                  code:
                    entry.itemType === "component"
                      ? "prerequisite-component"
                      : "prerequisite-kanji",
                  detail: "Published prerequisite outside the original deck.",
                },
              ]
            : [],
      })),
    });
    return { deckId: deck.id, itemCount: deck.itemCount };
  }

  private async plan(userId: string, deckId: string) {
    const deck = await this.lessons.findDeckEligibility(userId, deckId);
    if (deck === null || deck.status !== "active") throw new NotFoundException("Deck not found.");

    const members = new Map(deck.items.map(({ item }) => [item.id, item]));
    const known = new Map<string, LessonEligibilityItemRecord | null>(members);
    const progress = new Map<string, Map<string, number>>();
    const readProgress = async (ids: readonly string[]) => {
      for (const row of await this.lessons.listUserProgress(userId, ids)) {
        const stages = progress.get(row.learningItemId) ?? new Map<string, number>();
        stages.set(row.learningCardId, row.stageIndex);
        progress.set(row.learningItemId, stages);
      }
    };
    await readProgress([...members.keys()]);

    const visited = new Set<string>();
    const ready: LessonEligibilityItemRecord[] = [];
    const waiting = new Set<string>();
    const incomplete = new Set<string>();
    const unavailable = new Set<string>();
    const started = ({ id, cards }: LessonEligibilityItemRecord) =>
      cards.some((card) => progress.get(id)?.has(card.id));
    let frontier = [...members.values()].filter((item) => item.cards.length > 0 && !started(item));

    for (let depth = 0; frontier.length > 0; depth += 1) {
      const missingIds = [
        ...new Set(
          frontier.flatMap(({ dependencies }) =>
            dependencies
              .map(({ prerequisiteItemId }) => prerequisiteItemId)
              .filter((id) => !known.has(id)),
          ),
        ),
      ];
      if (depth >= MAX_GRAPH_DEPTH || known.size + missingIds.length > MAX_GRAPH_ITEMS)
        throw new BadRequestException("Слишком много предпосылок для одной колоды.");
      if (missingIds.length > 0) {
        const rows = await this.lessons.loadLessonEligibilityItems(missingIds);
        const byId = new Map(rows.map((row) => [row.id, row]));
        for (const id of missingIds) known.set(id, byId.get(id) ?? null);
        await readProgress(rows.map(({ id }) => id));
      }

      const next = new Map<string, LessonEligibilityItemRecord>();
      for (const item of frontier) {
        visited.add(item.id);
        let hasAllPrerequisites = true;
        for (const { prerequisiteItemId, requiredStage } of item.dependencies) {
          const prerequisite = known.get(prerequisiteItemId);
          if (
            prerequisite === undefined ||
            prerequisite === null ||
            prerequisite.cards.length === 0
          ) {
            hasAllPrerequisites = false;
            unavailable.add(prerequisiteItemId);
            continue;
          }
          const stages = progress.get(prerequisite.id);
          if (
            satisfiesCardPrerequisite(
              prerequisite.cards.map(({ id }) => id),
              stages,
              requiredStage,
            )
          )
            continue;

          hasAllPrerequisites = false;
          if (started(prerequisite)) {
            if (prerequisite.cards.some(({ id }) => !stages?.has(id)))
              incomplete.add(prerequisite.id);
            else waiting.add(prerequisite.id);
          } else if (!visited.has(prerequisite.id)) next.set(prerequisite.id, prerequisite);
        }
        if (hasAllPrerequisites && !members.has(item.id)) ready.push(item);
      }
      frontier = [...next.values()].filter(({ id }) => !visited.has(id));
    }

    return {
      title: deck.title,
      ready,
      waitingReviewCount: waiting.size,
      incompleteProgressCount: incomplete.size,
      unavailableCount: unavailable.size,
    };
  }
}
