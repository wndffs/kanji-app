import { test, expect, type Page } from "@playwright/test";
import { PRONUNCIATION_RECORDINGS, type ItemDetails } from "@kanji-srs/shared";

const entry = PRONUNCIATION_RECORDINGS[0];
const translations = {
  displayMode: "ru-en" as const,
  primaryRu: "есть",
  primaryEn: "eat",
  ru: [],
  en: [],
};
const item: ItemDetails = {
  id: "word-taberu",
  itemType: "word",
  slug: "word:食べる",
  japanese: "食べる",
  reading: "たべる",
  translations,
  level: 12,
  jlptLevel: null,
  srs: null,
  componentDetails: null,
  kanjiDetails: null,
  wordDetails: { reading: "たべる", commonnessRank: null, senses: [] },
  cards: [
    {
      id: "reading",
      learningItemId: "word-taberu",
      itemType: "word",
      cardType: "review",
      promptType: "reading",
      answerType: "reading",
      translationDisplayMode: "ru-en",
      prompt: { japanese: "食べる", reading: "たべる" },
      translations,
      acceptedAnswers: [
        { locale: "ru-RU", text: "たべる", isPrimary: true, sourceKind: "curated" },
      ],
      blockedAnswers: [],
      sortOrder: 1,
    },
  ],
  pronunciationAudio: {
    id: entry.id,
    learningItemId: "word-taberu",
    mediaUrl: entry.publicPath,
    storageKey: entry.publicPath,
    checksumSha256: entry.checksumSha256,
    durationMs: entry.durationMs,
    locale: "ja-JP",
    speakerName: entry.speaker,
    voiceMetadata: { origin: "human-recording" },
    sourceName: "Lingua Libre",
    sourceUrl: entry.sourceUrl,
    licenseName: entry.licenseName,
    licenseUrl: entry.licenseUrl,
    attributionText: entry.attribution,
    importRunId: "run",
    status: "published",
  },
  relations: [],
  relationGroups: [],
  nextReviewAt: null,
  reviewHistory: { items: [], nextCursor: null },
  mnemonics: { ru: [], en: [] },
  hints: { ru: [], en: [] },
  exampleSentences: [],
  attributions: [],
  userOverrides: [],
  strokeGraphic: null,
};
async function mock(page: Page) {
  await page.route("http://localhost:3001/search?*", (route) =>
    route.fulfill({
      json: {
        query: "食べる",
        items: [item],
        pagination: { page: 1, limit: 5, total: 1, hasNextPage: false },
      },
    }),
  );
  await page.route("http://localhost:3001/items/word-taberu", (route) =>
    route.fulfill({ json: item }),
  );
}
test("recorded recall conceals answers and credits until playback and grading, with no writes", async ({
  page,
}) => {
  await mock(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("http://localhost:3001") && request.method() !== "GET")
      writes.push(request.url());
  });
  await page.goto("/practice/listening");
  const input = page.getByRole("textbox", { name: "Чтение каной" });
  await expect(input).toBeDisabled();
  await expect(page.getByText("食べる", { exact: true })).toHaveCount(0);
  await expect(page.getByText("たべる", { exact: true })).toHaveCount(0);
  await expect(page.getByText(entry.attribution, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Воспроизвести аудио", exact: true }).click();
  await expect(input).toBeEnabled();
  expect(
    await page.locator("audio").evaluate((audio: HTMLAudioElement) => audio.duration),
  ).toBeCloseTo(1.032, 2);
  await input.fill("タベル");
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Верно", exact: true })).toBeVisible();
  await expect(page.getByText("食べる", { exact: true })).toBeVisible();
  await expect(page.getByText(entry.attribution, { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});
test("failed media stays ungraded and offers explicit reload", async ({ page }) => {
  await mock(page);
  await page.route(`**${entry.publicPath}`, (route) => route.abort());
  await page.goto("/practice/listening");
  await expect(page.getByRole("button", { name: "Повторить загрузку", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Чтение каной" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Верно", exact: true })).toHaveCount(0);
});
