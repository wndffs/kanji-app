import { expect, type Locator, type Page, type Route, test } from "@playwright/test";

import {
  type KanaAssessmentAnswerRequest,
  type KanaAssessmentAnswerResponse,
  type KanaAssessmentItemDto,
  type KanaAssessmentProgressDto,
  type KanaLessonPathDto,
  type KanaPracticeAnswerRequest,
  type KanaPracticeAnswerResponse,
  type KanaPracticeExerciseDto,
  type KanaPracticeScript,
  type KanaPracticeSessionDto,
  type KanaScript,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "kana-token";

test.describe("kana lessons", () => {
  test("opens a requested unlocked lesson character without recording an answer", async ({ page }) => {
    await signIn(page); await mockKanaApi(page);
    let writes = 0;
    page.on("request", (request) => { if (request.method() === "POST" && request.url().includes("/kana/")) writes++; });
    await page.goto("/kana?script=hiragana&mode=lessons&unit=hiragana-vowels&character=い");
    await expect(page.getByTestId("kana-practice")).toContainText("い");
    expect(writes).toBe(0);
  });
  for (const status of [200, 401]) {
    test(`ignores an older adaptive answer after account replacement (${status})`, async ({ page }) => {
      await signIn(page); await mockKanaApi(page);
      const exercise: KanaPracticeExerciseDto = { id: "owner-exercise", script: "hiragana", character: "あ", romaji: "a", exerciseKind: "typing", choices: [], focusReason: "new" };
      await page.route(`${API_BASE_URL}/kana/practice?script=hiragana`, (route) => route.fulfill({ json: buildPracticeSession("hiragana", 0, [exercise]) }));
      let release = () => {}; let requested = () => {};
      const held = new Promise<void>((resolve) => { release = resolve; });
      const seen = new Promise<void>((resolve) => { requested = resolve; });
      await page.route(`${API_BASE_URL}/kana/practice/answer`, async (route) => {
        requested(); await held;
        await route.fulfill({ status, json: status === 401 ? { message: "Old session" } : { correct: true, expected: "a", normalizedAnswer: "a", session: buildPracticeSession("hiragana", 1, [exercise]) } });
      });
      await page.goto("/kana?mode=practice");
      const practice = page.getByTestId("kana-adaptive-practice");
      await practice.getByLabel("Ромадзи", { exact: true }).fill("a");
      await practice.getByRole("button", { name: "Проверить", exact: true }).click();
      await seen;
      await page.evaluate(() => {
        const user = JSON.parse(localStorage.getItem("kanji-srs.user")!);
        localStorage.setItem("kanji-srs.accessToken", "kana-next-token");
        localStorage.setItem("kanji-srs.user", JSON.stringify({ ...user, id: "kana-next-user" }));
        window.dispatchEvent(new Event("kanji-srs.auth-changed"));
      });
      await expect(practice.getByLabel("Ромадзи", { exact: true })).toHaveValue("");
      const response = page.waitForResponse((response) => response.url().endsWith("/kana/practice/answer"));
      release(); await response;
      await expect(practice.getByLabel("Ромадзи", { exact: true })).toBeEnabled();
      expect(await page.evaluate(() => localStorage.getItem("kanji-srs.accessToken"))).toBe("kana-next-token");
      await expect(practice.getByRole("button", { name: "Продолжить", exact: true })).toHaveCount(0);
    });
  }
  for (const status of [200, 401]) {
    test(`isolates lesson data after an account change (${status})`, async ({ page }) => {
      await signIn(page); await mockKanaApi(page);
      let release = () => {}; let requested = () => {};
      const held = new Promise<void>((resolve) => { release = resolve; });
      const seen = new Promise<void>((resolve) => { requested = resolve; });
      await page.route(`${API_BASE_URL}/kana/lessons?script=hiragana`, async (route) => {
        if (route.request().headers().authorization === `Bearer ${ACCESS_TOKEN}`) {
          requested(); await held;
          await route.fulfill({ status, json: status === 401 ? { message: "Old session" } : buildLessonPath(buildProgress("hiragana", ["あ"])) });
        } else await route.fulfill({ json: buildLessonPath(buildProgress("hiragana", ["い"])) });
      });
      await page.goto("/kana"); await seen;
      await page.evaluate(() => {
        const user = JSON.parse(localStorage.getItem("kanji-srs.user")!);
        localStorage.setItem("kanji-srs.accessToken", "kana-new-token");
        localStorage.setItem("kanji-srs.user", JSON.stringify({ ...user, id: "kana-new-user" }));
        window.dispatchEvent(new Event("kanji-srs.auth-changed"));
      });
      await expect(page.getByTestId("kana-practice")).toContainText("い");
      const response = page.waitForResponse((response) => response.url().endsWith("/kana/lessons?script=hiragana") && response.request().headers().authorization === `Bearer ${ACCESS_TOKEN}`);
      release(); await response;
      await expect(page.getByTestId("kana-practice")).toContainText("い");
      expect(await page.evaluate(() => localStorage.getItem("kanji-srs.accessToken"))).toBe("kana-new-token");
    });
  }
  test("cancels obsolete kana speech on preferences, hiding and navigation", async ({ page }) => {
    await signIn(page);
    await mockKanaApi(page);
    await page.goto("/kana");
    await page.getByRole("tab", { name: "Проверка", exact: true }).click();
    await page.getByText("Карта знаков", { exact: true }).click();
    await page.getByRole("button", { name: "っか: прогресс 0 из 3" }).click();
    const speak = page.getByRole("button", { name: "Воспроизвести произношение" });
    await expect(speak).toBeEnabled();
    await speak.click();
    await speak.click();
    const beforePreferences = await page.evaluate(
      () => (window as typeof window & { __speechCancels: number }).__speechCancels,
    );
    await page.evaluate(() => {
      const audit = window as typeof window & { __speechEnds: (() => void)[] };
      audit.__speechEnds[0]?.();
      const user = JSON.parse(localStorage.getItem("kanji-srs.user")!);
      localStorage.setItem(
        "kanji-srs.user",
        JSON.stringify({ ...user, settings: { ...user.settings, speechRate: 1.1 } }),
      );
      window.dispatchEvent(new Event("kanji-srs.auth-changed"));
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as typeof window & { __speechCancels: number }).__speechCancels,
        ),
      )
      .toBeGreaterThan(beforePreferences);
    await speak.click();
    const beforeHidden = await page.evaluate(
      () => (window as typeof window & { __speechCancels: number }).__speechCancels,
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as typeof window & { __speechCancels: number }).__speechCancels,
        ),
      )
      .toBeGreaterThan(beforeHidden);
    await page.evaluate(() =>
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      }),
    );
    await speak.click();
    const beforeNavigation = await page.evaluate(
      () => (window as typeof window & { __speechCancels: number }).__speechCancels,
    );
    await page.getByRole("link", { name: "Поиск", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Поиск", exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as typeof window & { __speechCancels: number }).__speechCancels,
      ),
    ).toBeGreaterThan(beforeNavigation);
  });

  for (const lateStatus of [200, 401]) {
    test(`keeps katakana selected after a late hiragana response (${lateStatus})`, async ({
      page,
    }) => {
      await signIn(page);
      await mockKanaApi(page);
      let release = () => {};
      let signalRequest = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const requested = new Promise<void>((resolve) => {
        signalRequest = resolve;
      });
      await page.route(`${API_BASE_URL}/kana/practice?script=*`, async (route) => {
        const script = new URL(route.request().url()).searchParams.get("script") as KanaScript;
        const exercise: KanaPracticeExerciseDto = {
          id: `exercise-${script}`,
          script,
          character: script === "katakana" ? "カ" : "か",
          romaji: "ka",
          exerciseKind: "typing",
          choices: [],
          focusReason: "new",
        };
        if (script === "hiragana") {
          signalRequest();
          await held;
        }
        await route.fulfill({
          status: script === "hiragana" ? lateStatus : 200,
          json:
            script === "hiragana" && lateStatus === 401
              ? { message: "Expired older request" }
              : buildPracticeSession(script, 0, [exercise]),
        });
      });
      await page.goto("/kana?script=hiragana&mode=practice");
      await requested;
      await page.getByRole("button", { name: "Катакана", exact: true }).click();
      const practice = page.getByTestId("kana-adaptive-practice");
      await expect(practice.getByText("カ", { exact: true })).toBeVisible();
      const olderResponse = page.waitForResponse((response) =>
        response.url().endsWith("/kana/practice?script=hiragana"),
      );
      release();
      await olderResponse;
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await expect(page.getByRole("button", { name: "Катакана", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(practice.getByText("カ", { exact: true })).toBeVisible();
      await expect(practice.getByText("か", { exact: true })).toHaveCount(0);
    });
  }
  test("opens character-hub deep links in the requested mode and script", async ({ page }) => {
    await signIn(page);
    await mockKanaApi(page);

    await page.goto("/kana?script=katakana&mode=assessment");

    await expect(page.getByRole("tab", { name: "Проверка" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("button", { name: "Катакана" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("kana-practice")).toContainText("ア");

    await page.goto("/kana?script=mixed&mode=practice");
    await expect(page.getByRole("tab", { name: "Практика" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("button", { name: "Смешанная" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("kana-adaptive-practice")).toBeVisible();
  });

  test("rotates kana exercises and switches to katakana", async ({ page }) => {
    await signIn(page, { speechAutoplay: true });
    await mockKanaApi(page);

    await page.goto("/kana");

    const practice = page.getByTestId("kana-practice");
    await expect(page.getByRole("heading", { name: "Кана" })).toBeVisible();
    await expect(practice).toContainText("あ");
    await expect(practice).toContainText("a");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath("kana-study.png"), fullPage: true });
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as typeof window & { __spokenKana: readonly string[] }).__spokenKana.at(-1),
        ),
      )
      .toBe("あ");
    const yoonTile = page.getByTestId("kana-unit-list").getByText("きゃ", { exact: true });
    await expect(yoonTile).toBeHidden();
    await page.getByText("Все уроки", { exact: true }).click();
    await expect(yoonTile).toBeVisible();
    expect(await yoonTile.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    const sokuonTile = page.getByTestId("kana-unit-list").getByText("っか", { exact: true });
    const longVowelTile = page.getByTestId("kana-unit-list").getByText("おう", { exact: true });
    await expect(sokuonTile).toBeVisible();
    await expect(longVowelTile).toBeVisible();
    expect(await sokuonTile.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    expect(
      await longVowelTile.evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page.getByRole("tab", { name: "Проверка" }).click();
    const assessmentYoon = page.getByRole("button", { name: "きゃ: прогресс 0 из 3" });
    await page.getByText("Карта знаков", { exact: true }).click();
    await expect(assessmentYoon).toBeVisible();
    expect(
      await assessmentYoon.evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page.getByRole("tab", { name: "Уроки" }).click();
    await page.getByRole("button", { name: "Проверить чтение" }).click();
    await page.getByLabel("Ромадзи").fill("a");
    await page.getByRole("button", { name: "Проверить" }).click();

    await expect(practice.getByText("Верно")).toBeVisible();
    await expect(practice.getByText("a", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Следующий" }).click();
    await expect(practice).toContainText("い");

    await page.getByRole("button", { name: "Проверить чтение" }).click();
    await expect(practice.getByText("Выберите чтение", { exact: true })).toBeVisible();
    await practice.getByRole("button", { name: "i", exact: true }).click();
    await expect(practice.getByText("Верно")).toBeVisible();
    await page.getByRole("button", { name: "Следующий" }).click();
    await expect(practice).toContainText("う");

    await page.getByRole("button", { name: "Проверить чтение" }).click();
    await expect(practice.getByText("Выберите знак", { exact: true })).toBeVisible();
    await practice.getByRole("button", { name: "う", exact: true }).click();
    await expect(practice.getByText("Верно")).toBeVisible();

    await page.getByRole("tab", { name: "Проверка" }).click();
    await page.getByText("Карта знаков", { exact: true }).click();
    await page.getByRole("button", { name: "っか: прогресс 0 из 3" }).click();
    await expect(practice.getByText("Аудирование", { exact: true })).toBeVisible();
    await practice.getByRole("button", { name: "Воспроизвести произношение" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as typeof window & { __spokenKana: readonly string[] }).__spokenKana.at(-1),
        ),
      )
      .toBe("かっか");
    await practice.getByRole("button", { name: "っか", exact: true }).click();
    await expect(practice.getByText("Верно")).toBeVisible();
    await page.getByRole("button", { name: "Следующий" }).click();

    await page.getByRole("button", { name: "え: прогресс 0 из 3" }).click();
    await expect(practice.getByText("Обводка", { exact: true })).toBeVisible();
    const traceSurface = practice.getByTestId("kana-trace-surface");
    await traceLine(page, traceSurface, { x: 15, y: 30 }, { x: 94, y: 30 });
    await traceLine(page, traceSurface, { x: 15, y: 75 }, { x: 94, y: 75 });
    await expect(practice.getByText("Знак обведён", { exact: true })).toBeVisible();
    await expect(practice.getByText("Верно")).toBeVisible();
    await page.getByRole("button", { name: "Следующий" }).click();

    await page.getByRole("button", { name: "きゃ: прогресс 0 из 3" }).click();
    await expect(practice.getByText("Сопоставление", { exact: true })).toBeVisible();
    for (const [character, romaji] of [
      ["きゃ", "kya"],
      ["う", "u"],
      ["っか", "kka"],
    ] as const) {
      await practice.getByRole("button", { name: character, exact: true }).click();
      await practice.getByRole("button", { name: romaji, exact: true }).click();
    }
    await expect(practice.getByText("Все пары собраны", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Уроки" }).click();
    await page.getByRole("button", { name: "Катакана" }).click();
    await expect(practice).toContainText("ア");
    await page.getByText("Все уроки", { exact: true }).click();
    await expect(
      page.getByTestId("kana-unit-list").getByText("キャ", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("kana-unit-list").getByText("ッカ", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("kana-unit-list").getByText("オー", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Освоено 0%" })).toBeVisible();
  });

  test("resumes a mixed adaptive session and keeps exercise evidence distinct", async ({
    page,
  }) => {
    await signIn(page);
    await mockKanaApi(page);

    await page.goto("/kana");
    await page.getByRole("tab", { name: "Практика" }).click();
    await page.getByRole("button", { name: "Смешанная" }).click();

    const practice = page.getByTestId("kana-adaptive-practice");
    await expect(practice.getByText("あ", { exact: true })).toBeVisible();
    await expect(practice.getByText("Распознавание", { exact: true })).toBeVisible();

    await page.reload();
    await page.getByRole("tab", { name: "Практика" }).click();
    await page.getByRole("button", { name: "Смешанная" }).click();
    await expect(practice.getByText("あ", { exact: true })).toBeVisible();

    await practice.getByRole("button", { name: "a", exact: true }).click();
    await expect(practice.getByText("Верно", { exact: true })).toBeVisible();
    await practice.getByRole("button", { name: "Следующий" }).click();
    await expect(practice.getByText("a", { exact: true })).toBeVisible();
    await expect(practice.getByText("Звук → знак", { exact: true })).toBeVisible();
    await practice.getByRole("button", { name: "ア", exact: true }).click();
    await expect(practice.getByText("Верно", { exact: true })).toBeVisible();
  });
});

async function signIn(
  page: Page,
  audioSettings: { readonly speechAutoplay?: boolean } = {},
): Promise<void> {
  await page.addInitScript(
    ({ accessToken, audioSettings: storedAudioSettings }) => {
      const speechWindow = window as typeof window & {
        __spokenKana: string[];
        __speechCancels: number;
        __speechEnds: (() => void)[];
      };
      speechWindow.__spokenKana = [];
      speechWindow.__speechCancels = 0;
      speechWindow.__speechEnds = [];
      class MockSpeechSynthesisUtterance {
        onend: (() => void) | null = null;
        lang = "";
        pitch = 1;
        rate = 1;
        text: string;
        voice: SpeechSynthesisVoice | null = null;

        constructor(text: string) {
          this.text = text;
        }
      }

      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        configurable: true,
        value: MockSpeechSynthesisUtterance,
      });
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          addEventListener: () => undefined,
          cancel: () => {
            speechWindow.__speechCancels++;
          },
          getVoices: () => [
            {
              default: true,
              lang: "ja-JP",
              name: "Test Japanese",
              voiceURI: "voice-ja",
            },
          ],
          removeEventListener: () => undefined,
          speak: (utterance: MockSpeechSynthesisUtterance) => {
            speechWindow.__spokenKana.push(utterance.text);
            speechWindow.__speechEnds.push(() => utterance.onend?.());
          },
        },
      });

      window.localStorage.setItem("kanji-srs.accessToken", accessToken);
      window.localStorage.setItem("kanji-srs.translationDisplayMode", "ru-en");
      window.localStorage.setItem(
        "kanji-srs.user",
        JSON.stringify({
          id: "user-1",
          email: "learner@example.test",
          displayName: "Ученик",
          role: "USER",
          settings: {
            locale: "ru-RU",
            translationDisplayMode: "ru-en",
            timezone: "Europe/Moscow",
            dailyLessonLimit: 20,
            reviewBudget: 100,
            strictMode: false,
            speechVoiceUri: null,
            speechRate: 0.8,
            speechAutoplay: false,
            soundFeedback: false,
            ...storedAudioSettings,
          },
        }),
      );
    },
    { accessToken: ACCESS_TOKEN, audioSettings },
  );
}

async function mockKanaApi(page: Page): Promise<void> {
  const progressByScript = new Map<KanaScript, KanaAssessmentProgressDto>([
    ["hiragana", buildProgress("hiragana", ["あ", "い", "う", "きゃ", "っか", "え", "おう"])],
    ["katakana", buildProgress("katakana", ["ア", "イ", "ウ", "キャ", "ッカ", "エ", "オー"])],
  ]);
  const practiceItems = buildMockPracticeItems();
  const practiceIndex = new Map<KanaPracticeScript, number>();

  await page.route("**/api/kana-strokes/*", async (route) => {
    await route.fulfill({
      body: `<?xml version="1.0" encoding="UTF-8"?>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109 109">
          <g id="kvg:StrokePaths_03048">
            <path id="kvg:03048-s1" d="M15,30 L94,30" />
            <path id="kvg:03048-s2" d="M15,75 L94,75" />
          </g>
        </svg>`,
      contentType: "image/svg+xml",
    });
  });

  await page.route(`${API_BASE_URL}/kana/assessment?script=*`, async (route) => {
    const script = new URL(route.request().url()).searchParams.get("script") as KanaScript;
    await route.fulfill({ json: progressByScript.get(script) });
  });

  await page.route(`${API_BASE_URL}/kana/lessons?script=*`, async (route) => {
    const script = new URL(route.request().url()).searchParams.get("script") as KanaScript;
    await route.fulfill({ json: buildLessonPath(progressByScript.get(script)!) });
  });

  await page.route(`${API_BASE_URL}/kana/assessment/answer`, async (route) => {
    await answerKanaRoute(route, progressByScript);
  });

  await page.route(`${API_BASE_URL}/kana/lessons/answer`, async (route) => {
    await answerKanaRoute(route, progressByScript);
  });

  await page.route(`${API_BASE_URL}/kana/practice?script=*`, async (route) => {
    const script = new URL(route.request().url()).searchParams.get("script") as KanaPracticeScript;
    const currentIndex = practiceIndex.get(script) ?? 0;
    await route.fulfill({
      json: buildPracticeSession(script, currentIndex, practiceItems),
    });
  });

  await page.route(`${API_BASE_URL}/kana/practice/answer`, async (route) => {
    const body = route.request().postDataJSON() as KanaPracticeAnswerRequest;
    const script = body.sessionId.replace("practice-", "") as KanaPracticeScript;
    const currentIndex = practiceIndex.get(script) ?? 0;
    const exercise = practiceItems[currentIndex]!;
    const correct =
      body.answer === exercise.romaji || body.selectedCharacter === exercise.character;
    const nextIndex = currentIndex + 1;
    practiceIndex.set(script, nextIndex);
    const response: KanaPracticeAnswerResponse = {
      correct,
      normalizedAnswer: body.answer ?? null,
      expectedCharacter: exercise.character,
      expectedRomaji: exercise.romaji,
      selectedCharacter: body.selectedCharacter ?? null,
      confusionExplanation: correct ? null : "Сравните форму и чтение знаков.",
      session: buildPracticeSession(script, nextIndex, practiceItems),
    };
    await route.fulfill({ json: response });
  });
}

async function answerKanaRoute(
  route: Route,
  progressByScript: Map<KanaScript, KanaAssessmentProgressDto>,
): Promise<void> {
  const body = route.request().postDataJSON() as KanaAssessmentAnswerRequest;
  const script = [...progressByScript.entries()].find(([, candidate]) =>
    candidate.items.some((item) => item.character === body.character),
  )?.[0];

  if (script === undefined) {
    throw new Error(`Unknown mocked kana ${body.character}.`);
  }

  const progress = progressByScript.get(script)!;
  const current = progress.items.find((item) => item.character === body.character)!;
  const expectedRomaji = getMockRomaji(body.character);
  const correct = body.answer === expectedRomaji;
  const updated: KanaAssessmentItemDto = {
    ...current,
    attemptCount: current.attemptCount + 1,
    correctCount: current.correctCount + (correct ? 1 : 0),
    currentStreak: correct ? current.currentStreak + 1 : 0,
    lastAnsweredAt: "2026-07-11T18:00:00.000Z",
  };
  progressByScript.set(script, {
    ...progress,
    attemptedCount: 1,
    items: progress.items.map((item) => (item.character === updated.character ? updated : item)),
  });
  const response: KanaAssessmentAnswerResponse = {
    correct,
    normalizedAnswer: body.answer,
    expectedRomaji,
    item: updated,
    attemptedCount: 1,
    masteredCount: 0,
  };

  await route.fulfill({ json: response });
}

function buildProgress(
  script: KanaScript,
  characters: readonly string[],
): KanaAssessmentProgressDto {
  return {
    script,
    masteryThreshold: 3,
    totalCount: characters.length,
    attemptedCount: 0,
    masteredCount: 0,
    items: characters.map((character, order) => {
      const metadata = getMockKanaMetadata(character);

      return {
        character,
        script,
        row: metadata.row,
        order,
        variant: metadata.variant,
        baseCharacter: metadata.baseCharacter,
        attemptCount: 0,
        correctCount: 0,
        currentStreak: 0,
        mastered: false,
        lastAnsweredAt: null,
      };
    }),
  };
}

function buildLessonPath(progress: KanaAssessmentProgressDto): KanaLessonPathDto {
  const vowels = progress.items.filter((item) => item.row === "vowels");
  const yoon = progress.items.filter((item) => item.row === "ky");
  const sokuon = progress.items.filter((item) => item.row === "sokuon");
  const longVowels = progress.items.filter((item) => item.row === "long-vowel");

  return {
    script: progress.script,
    masteryThreshold: progress.masteryThreshold,
    masteredCount: progress.masteredCount,
    totalCount: progress.totalCount,
    units: [
      {
        id: `${progress.script}-vowels`,
        script: progress.script,
        title: "Гласные",
        order: 0,
        unlocked: true,
        complete: false,
        masteredCount: 0,
        totalCount: vowels.length,
        items: vowels.map((item, index) => ({
          ...item,
          romaji: ["a", "i", "u", "e"][index] ?? "a",
        })),
      },
      {
        id: `${progress.script}-ky`,
        script: progress.script,
        title: "Ёон: KY",
        order: 1,
        unlocked: false,
        complete: false,
        masteredCount: 0,
        totalCount: yoon.length,
        items: yoon.map((item) => ({ ...item, romaji: "kya" })),
      },
      {
        id: `${progress.script}-sokuon`,
        script: progress.script,
        title: "Малая っ: удвоение",
        order: 2,
        unlocked: false,
        complete: false,
        masteredCount: 0,
        totalCount: sokuon.length,
        items: sokuon.map((item) => ({ ...item, romaji: "kka" })),
      },
      {
        id: `${progress.script}-long-vowels`,
        script: progress.script,
        title: "Долгие гласные",
        order: 3,
        unlocked: false,
        complete: false,
        masteredCount: 0,
        totalCount: longVowels.length,
        items: longVowels.map((item) => ({
          ...item,
          romaji: item.character === "おう" ? "ou" : "oo",
        })),
      },
    ],
  };
}

function getMockKanaMetadata(
  character: string,
): Pick<KanaAssessmentItemDto, "row" | "variant" | "baseCharacter"> {
  if (character === "きゃ" || character === "キャ") {
    return { row: "ky", variant: "yoon", baseCharacter: character[0] ?? character };
  }

  if (character === "っか" || character === "ッカ") {
    return { row: "sokuon", variant: "sokuon", baseCharacter: character[0] ?? character };
  }

  if (character === "おう" || character === "オー") {
    return { row: "long-vowel", variant: "long-vowel", baseCharacter: character[0] ?? character };
  }

  return { row: "vowels", variant: "basic", baseCharacter: character };
}

function getMockRomaji(character: string): string {
  const romaji = new Map([
    ["あ", "a"],
    ["い", "i"],
    ["う", "u"],
    ["きゃ", "kya"],
    ["っか", "kka"],
    ["え", "e"],
    ["おう", "ou"],
    ["ア", "a"],
    ["イ", "i"],
    ["ウ", "u"],
    ["キャ", "kya"],
    ["ッカ", "kka"],
    ["エ", "e"],
    ["オー", "oo"],
  ]).get(character);

  if (romaji === undefined) {
    throw new Error(`Unknown mocked kana ${character}.`);
  }

  return romaji;
}

function buildMockPracticeItems(): readonly KanaPracticeExerciseDto[] {
  const choices = [
    { character: "あ", script: "hiragana" as const, romaji: "a" },
    { character: "ア", script: "katakana" as const, romaji: "a" },
    { character: "い", script: "hiragana" as const, romaji: "i" },
    { character: "イ", script: "katakana" as const, romaji: "i" },
  ];

  return [
    {
      id: "mixed-1",
      character: "あ",
      script: "hiragana",
      romaji: "a",
      exerciseKind: "recognition-choice",
      choices: [choices[0]!, choices[2]!],
      focusReason: "weak",
    },
    {
      id: "mixed-2",
      character: "ア",
      script: "katakana",
      romaji: "a",
      exerciseKind: "reverse-choice",
      choices,
      focusReason: "overdue",
    },
    {
      id: "mixed-3",
      character: "い",
      script: "hiragana",
      romaji: "i",
      exerciseKind: "typing",
      choices,
      focusReason: "new",
    },
  ];
}

function buildPracticeSession(
  script: KanaPracticeScript,
  currentIndex: number,
  items: readonly KanaPracticeExerciseDto[],
): KanaPracticeSessionDto {
  return {
    id: `practice-${script}`,
    script,
    currentIndex,
    completedCount: currentIndex,
    totalCount: items.length,
    startedAt: "2026-07-27T12:00:00.000Z",
    exercise: items[currentIndex] ?? null,
  };
}

async function traceLine(
  page: Page,
  surface: Locator,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): Promise<void> {
  const bounds = await surface.boundingBox();

  if (bounds === null) {
    throw new Error("Kana trace surface is not visible.");
  }

  const start = {
    x: bounds.x + (from.x / 109) * bounds.width,
    y: bounds.y + (from.y / 109) * bounds.height,
  };
  const end = {
    x: bounds.x + (to.x / 109) * bounds.width,
    y: bounds.y + (to.y / 109) * bounds.height,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 24 });
  await page.mouse.up();
}
