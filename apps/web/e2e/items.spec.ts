import { expect, type Page, test } from "@playwright/test";
import { captureLearnerThemes } from "./support/capture-learner-themes";
import { changeAccount } from "./support/change-account";

import {
  type ContentLocale,
  type ItemDetails,
  type UserMnemonicDto,
  type UserOverrideDto,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";
const ITEM_ID = "item-kanji-one";
const COMPONENT_ID = "item-component-one";
const WORD_ID = "item-word-school";

test.describe("item details", () => {
  test("preserves course return context through component study links", async ({ page }) => {
    await signIn(page);
    await mockItemApi(page);
    const courseId = "00000000-0000-4000-8000-000000000010";
    await page.goto(`/items/${ITEM_ID}?courseId=${courseId}&level=2&q=one`);
    const group = page.getByTestId("item-relation-groups");
    await expect(group).toContainText("Компонент — зрительная опора.");
    const link = group.getByRole("link", { name: "一", exact: true });
    await expect(link).toHaveAttribute(
      "href",
      `/items/${COMPONENT_ID}?level=2&q=one&courseId=${courseId}`,
    );
    await link.click();
    await expect(
      page.getByRole("link", { name: "К материалам уровня", exact: true }),
    ).toHaveAttribute("href", `/courses/${courseId}?level=2&q=one`);
  });
  test("connects selected readings to whole-word reinforcement without losing course context", async ({
    page,
  }) => {
    await signIn(page);
    await mockItemApi(page);
    const item = buildItemDetails([], null);
    Object.assign(item, {
      relationGroups: [
        {
          kind: "vocabulary",
          total: 1,
          items: [
            {
              ...item.relationGroups[0]!.items[0]!,
              id: WORD_ID,
              itemType: "word",
              japanese: "学校",
              reading: "がっこう",
            },
          ],
        },
      ],
    });
    await page.route(`${API_BASE_URL}/items/${ITEM_ID}`, (route) => route.fulfill({ json: item }));
    await page.goto(`/items/${ITEM_ID}?courseId=00000000-0000-4000-8000-000000000010&level=2`);
    const reading = page.getByTestId("kanji-reading-details");
    await expect(reading).toContainText("Учебное чтение относится к этой карточке кандзи.");
    await reading.getByRole("link", { name: "Слова с этим кандзи", exact: true }).click();
    await expect(page).toHaveURL(/level=2#item-related-vocabulary$/u);
    await expect(
      page.getByTestId("item-relation-groups").getByRole("link", { name: "学校", exact: true }),
    ).toHaveAttribute("href", /courseId=00000000-0000-4000-8000-000000000010/u);
  });
  test("renders teaching before slow notes and retries a failed private snapshot without losing the item", async ({
    page,
  }) => {
    await signIn(page);
    await mockItemApi(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reads = 0;
    await page.route(`${API_BASE_URL}/items/${ITEM_ID}/private-mnemonics`, async (route) => {
      if (++reads === 1) {
        await gate;
        await route.fulfill({ status: 503, json: { message: "Notes temporarily unavailable" } });
      } else await route.fulfill({ json: [buildMnemonic("ru-RU", "story")] });
    });
    try {
      await page.goto(`/items/${ITEM_ID}?view=personal`);
      await expect(page.getByRole("heading", { name: "一", exact: true })).toBeVisible();
      await expect(page.getByTestId("private-mnemonic-body")).toBeDisabled();
      await expect(page.getByText("Личных заметок пока нет.", { exact: true })).toHaveCount(0);
      release();
      await expect(page.getByText("Notes temporarily unavailable", { exact: true })).toBeVisible();
      await expect(page.getByTestId("private-mnemonic-submit")).toBeDisabled();
      await expect(page.getByText("Личных заметок пока нет.", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Повторить загрузку заметок", exact: true }).click();
      await expect(page.getByTestId("private-mnemonic-body")).toHaveValue("ru-RU:story");
      await expect(page.getByTestId("private-mnemonic-body")).toBeEnabled();
      expect(reads).toBe(2);
    } finally {
      release();
    }
  });

  for (const status of [200, 401]) {
    test(`ignores late private notes after an account change (${status})`, async ({ page }) => {
      await signIn(page);
      await mockItemApi(page);
      let release!: () => void;
      let started!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const pending = new Promise<void>((resolve) => {
        started = resolve;
      });
      await page.route(`${API_BASE_URL}/items/${ITEM_ID}/private-mnemonics`, async (route) => {
        if (route.request().headers().authorization === `Bearer ${ACCESS_TOKEN}`) {
          started();
          await gate;
          await route
            .fulfill({
              status,
              json:
                status === 200
                  ? [{ ...buildMnemonic("ru-RU", "story"), body: "old private body" }]
                  : { message: "old owner expired" },
            })
            .catch(() => undefined);
        } else
          await route.fulfill({
            json: [{ ...buildMnemonic("ru-RU", "story"), body: "new owner body" }],
          });
      });
      try {
        await page.goto(`/items/${ITEM_ID}?view=personal`);
        await pending;
        await changeAccount(page);
        await expect(page.getByTestId("private-mnemonic-body")).toHaveValue("new owner body");
        release();
        await expect(page.getByText("old private body", { exact: true })).toHaveCount(0);
        await expect(page.getByText("old owner expired", { exact: true })).toHaveCount(0);
        expect(await page.evaluate(() => localStorage.getItem("kanji-srs.accessToken"))).toBe(
          "new-owner-token",
        );
      } finally {
        release();
      }
    });
  }

  test("restores view URL, Back and catalogue context without refetching on tab changes", async ({
    page,
  }, info) => {
    await signIn(page);
    await mockItemApi(page);
    let reads = 0;
    await page.route(`${API_BASE_URL}/kanji/${encodeURIComponent("一")}`, (route) => {
      reads++;
      return route.fulfill({ json: buildItemDetails([], null) });
    });
    const catalogue = "/characters?tab=kanji&q=ichi&view=list";
    await page.goto(
      `/kanji/${encodeURIComponent("一")}?${new URLSearchParams({ catalogue, view: "sources" })}`,
    );
    await expect(page.getByRole("tab", { name: "Источники", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("tab", { name: "Мои записи", exact: true }).click();
    await page.getByTestId("private-mnemonic-body").fill("unsaved draft");
    await expect(page.getByText("Несохранённых заметок: 1", { exact: true })).toBeVisible();
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo(0, 0);
    });
    await captureLearnerThemes(page, info, "material-notes");
    await page.getByRole("tab", { name: "История", exact: true }).click();
    await expect(page.getByTestId("item-srs-history")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("private-mnemonic-body")).toHaveValue("unsaved draft");
    expect(reads).toBe(1);
    await page.getByRole("tab", { name: "Источники", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("view=sources"));
    await page.reload();
    await expect(page.getByRole("heading", { name: "Источники", exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "К каталогу кандзи", exact: true }),
    ).toHaveAttribute("href", catalogue);
    expect(reads).toBe(2);
  });

  test("conceals structured kanji and relation readings until deliberate reveal", async ({
    page,
  }) => {
    await signIn(page);
    await mockItemApi(page);
    const item = buildItemDetails([], null);
    Object.assign(item, {
      relationGroups: item.relationGroups.map((group) => ({
        ...group,
        items: group.items.map((related) => ({ ...related, reading: "ひとり" })),
      })),
    });
    await page.route(`${API_BASE_URL}/items/${ITEM_ID}`, (route) => route.fulfill({ json: item }));
    await page.goto(`/items/${ITEM_ID}`);
    const details = page.getByTestId("kanji-reading-details");
    await expect(details.getByText("ひと", { exact: true })).toBeHidden();
    await details.getByRole("button", { name: "Словарные чтения", exact: true }).click();
    await expect(details.getByText("ひと", { exact: true })).toBeVisible();
    await page.getByLabel("Скрыть подсказки чтения", { exact: true }).check();
    await expect(page.locator(".item-study-memory")).toBeHidden();
    await expect(details).toContainText("Чтение скрыто.");
    await expect(details.getByText("いち", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("item-relation-groups")).not.toContainText("ひとり");
    await expect(page.getByRole("button", { name: "Прослушать чтение", exact: true })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Показать чтение", exact: true }).click();
    await expect(page.locator(".item-study-memory")).toBeVisible();
    await expect(
      details.locator(".reading-evidence-grid").first().getByText("いち", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("item-relation-groups")).not.toContainText("ひとり");
  });

  test("bounds related materials and examples without pretending unloaded entries are available", async ({
    page,
  }, info) => {
    await signIn(page);
    await mockItemApi(page);
    const item = buildItemDetails([], null);
    const related = item.relationGroups[0]!.items[0]!;
    Object.assign(item, {
      relationGroups: [
        {
          kind: "vocabulary",
          total: 20,
          items: Array.from({ length: 9 }, (_, index) => ({
            ...related,
            id: `related-${index}`,
            japanese: `一${index}`,
            reading: "いち",
          })),
        },
      ],
      exampleSentences: Array.from({ length: 5 }, (_, index) => ({
        ...item.exampleSentences[0]!,
        id: `example-${index}`,
        attribution: buildWordDetails().exampleSentences[0]!.attribution,
      })),
    });
    await page.route(`${API_BASE_URL}/items/${ITEM_ID}`, (route) => route.fulfill({ json: item }));
    await page.goto(`/items/${ITEM_ID}`);
    const relations = page.getByTestId("item-relation-groups");
    await expect(relations.locator("li")).toHaveCount(6);
    await expect(relations).toContainText("Показано 6 из 20 · загружено 9.");
    await relations
      .getByRole("button", { name: "Показать ещё: Слова, закрепляющие материал", exact: true })
      .click();
    await expect(relations.locator("li")).toHaveCount(9);
    await expect(relations).toContainText("Показано 9 из 20 · загружено 9.");
    await relations
      .getByRole("button", { name: "Свернуть: Слова, закрепляющие материал", exact: true })
      .click();
    await expect(page.locator(".example-list > li")).toHaveCount(3);
    await page.getByRole("button", { name: "Показать ещё: Примеры", exact: true }).click();
    await expect(page.locator(".example-list > li")).toHaveCount(5);
    await expect(page.locator(".example-list > li").first()).toContainText("One, please.");
    await expect(page.locator(".example-list > li").first()).toContainText("Project examples");
    await captureLearnerThemes(page, info, "material-study");
  });

  for (const mode of ["ru", "en", "ru-en"] as const) {
    test(`labels missing hero translations in ${mode} without other-language substitution`, async ({
      page,
    }) => {
      await signIn(page, { translationDisplayMode: mode });
      await mockItemApi(page);
      const item = buildItemDetails([], null);
      Object.assign(item, { translations: { ...item.translations, primaryRu: null } });
      await page.route(`${API_BASE_URL}/items/${ITEM_ID}`, (route) =>
        route.fulfill({ json: item }),
      );
      await page.goto(`/items/${ITEM_ID}`);
      const rows = page.locator(".item-hero .item-translation-rows");
      await expect(rows.locator("dt")).toHaveText(
        mode === "ru-en" ? ["RU", "EN"] : [mode.toUpperCase()],
      );
      if (mode !== "en") await expect(rows).toContainText("Перевод пока не добавлен");
      if (mode !== "ru") await expect(rows).toContainText("one");
      else await expect(rows).not.toContainText("one");
    });
  }

  test("keeps cardless personal answers unavailable and learning free from private mnemonic duplication", async ({
    page,
  }) => {
    await signIn(page);
    await mockItemApi(page, {
      mnemonics: [{ ...buildMnemonic("ru-RU", "story"), body: "private only story" }],
    });
    const item = buildItemDetails([], null);
    Object.assign(item, {
      cards: [],
      mnemonics: {
        ...item.mnemonics,
        ru: [
          ...item.mnemonics.ru,
          { locale: "ru-RU", text: "private only story", sourceKind: "user" },
        ],
      },
    });
    await page.route(`${API_BASE_URL}/items/${ITEM_ID}`, (route) => route.fulfill({ json: item }));
    await page.goto(`/items/${ITEM_ID}`);
    await expect(page.locator(".item-study-memory")).not.toContainText("private only story");
    await page.getByRole("tab", { name: "Мои записи", exact: true }).click();
    await expect(
      page.getByText("У этого материала пока нет учебных карточек для личных ответов.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByTestId("private-answer-form")).toHaveCount(0);
    await expect(
      privatePanel(page, "Приватная заметка")
        .locator(".lesson-text-list")
        .getByText("private only story", { exact: true }),
    ).toBeVisible();
  });

  test("speaks only visible readings, never autoplays, and cancels on hide and view change", async ({
    page,
  }) => {
    await signIn(page, { speechAutoplay: true, speechRate: 0.8 });
    await mockItemApi(page);
    await page.addInitScript(() => {
      const state = window as typeof window & {
        spoken: { text: string; rate: number; lang: string }[];
        cancels: number;
      };
      state.spoken = [];
      state.cancels = 0;
      class Utterance {
        text: string;
        constructor(text: string) {
          this.text = text;
        }
      }
      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        configurable: true,
        value: Utterance,
      });
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          getVoices: () => [{ lang: "ja-JP", voiceURI: "ja", name: "Japanese", default: true }],
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          cancel: () => {
            state.cancels++;
          },
          speak: (value: SpeechSynthesisUtterance) => {
            state.spoken.push({ text: value.text, rate: value.rate, lang: value.lang });
          },
        },
      });
    });
    const snapshot = () =>
      page.evaluate(() => {
        const state = window as typeof window & {
          spoken: { text: string; rate: number; lang: string }[];
          cancels: number;
        };
        return { spoken: state.spoken, cancels: state.cancels };
      });
    await page.goto(`/items/${ITEM_ID}`);
    const play = page.getByRole("button", { name: "Прослушать чтение", exact: true });
    await expect(play).toBeEnabled();
    expect((await snapshot()).spoken).toEqual([]);
    await play.click();
    expect((await snapshot()).spoken).toEqual([{ text: "いち", rate: 0.8, lang: "ja-JP" }]);
    const beforeHide = (await snapshot()).cancels;
    await page.getByLabel("Скрыть подсказки чтения", { exact: true }).check();
    await expect(play).toHaveCount(0);
    expect((await snapshot()).cancels).toBeGreaterThan(beforeHide);
    await page.getByRole("button", { name: "Показать чтение", exact: true }).click();
    await play.click();
    const beforeView = (await snapshot()).cancels;
    await page.getByRole("tab", { name: "История", exact: true }).click();
    await expect(play).toHaveCount(0);
    expect((await snapshot()).cancels).toBeGreaterThan(beforeView);
  });

  for (const denied of [false, true]) {
    test(`copies only a visible kana reading and reports clipboard denial (${denied})`, async ({
      page,
    }) => {
      await signIn(page);
      await mockItemApi(page);
      await page.addInitScript((fail) => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text: string) => {
              if (fail) throw new Error("denied");
              (window as typeof window & { copiedReading: string }).copiedReading = text;
            },
          },
        });
      }, denied);
      await page.goto(`/items/${ITEM_ID}`);
      await page.getByRole("button", { name: "Копировать чтение", exact: true }).click();
      await expect(
        page.getByRole("status", { name: "Копирование чтения", exact: true }),
      ).toHaveText(denied ? "Не удалось скопировать" : "Скопировано");
      if (!denied)
        expect(
          await page.evaluate(
            () => (window as typeof window & { copiedReading: string }).copiedReading,
          ),
        ).toBe("いち");
      await page.getByLabel("Скрыть подсказки чтения", { exact: true }).check();
      await expect(
        page.getByRole("button", { name: "Копировать чтение", exact: true }),
      ).toHaveCount(0);
    });
  }
  test("does not append an old user's pending history or clear a newer login", async ({ page }) => {
    await signIn(page);
    await mockItemApi(page);
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      started = resolve;
    });
    await page.route(`${API_BASE_URL}/items/${ITEM_ID}`, async (route) => {
      const item = buildItemDetails([], null);
      if (route.request().headers().authorization === "Bearer new-token") {
        Object.assign(item, {
          reviewHistory: { items: [], nextCursor: null },
          srs: null,
          nextReviewAt: null,
        });
      }
      await route.fulfill({ json: item });
    });
    await page.route(`${API_BASE_URL}/items/${ITEM_ID}/history?cursor=older`, async (route) => {
      started();
      await gate;
      await route
        .fulfill({ status: 401, json: { message: "Old login expired" } })
        .catch(() => undefined);
    });
    try {
      await page.goto(`/items/${ITEM_ID}`);
      await page.getByRole("tab", { name: "История", exact: true }).click();
      await page
        .getByTestId("item-srs-history")
        .getByRole("button", { name: "Показать более ранние" })
        .click();
      await pending;
      await page.evaluate(() => {
        localStorage.setItem("kanji-srs.accessToken", "new-token");
        const user = JSON.parse(localStorage.getItem("kanji-srs.user")!);
        localStorage.setItem("kanji-srs.user", JSON.stringify({ ...user, id: "new-owner" }));
        window.dispatchEvent(new Event("kanji-srs.auth-changed"));
      });
      await expect(page.getByTestId("item-srs-history")).toContainText("ещё нет истории");
      release();
      expect(await page.evaluate(() => localStorage.getItem("kanji-srs.accessToken"))).toBe(
        "new-token",
      );
      await expect(page.getByText("Old login expired")).toHaveCount(0);
    } finally {
      release();
    }
  });

  test("deduplicates overlapping history pages without duplicating SRS events", async ({
    page,
  }) => {
    await signIn(page);
    await mockItemApi(page);
    const entry = buildItemDetails([], null).reviewHistory.items[0]!;
    await page.route(`${API_BASE_URL}/items/${ITEM_ID}/history?cursor=older`, async (route) => {
      await route.fulfill({
        json: {
          items: [entry, { ...entry, id: "older-distinct", result: "manual-ignore" }],
          nextCursor: null,
        },
      });
    });
    await page.goto(`/items/${ITEM_ID}`);
    const history = page.getByTestId("item-srs-history");
    await page.getByRole("tab", { name: "История", exact: true }).click();
    await history.getByRole("button", { name: "Показать более ранние" }).click();
    await expect(history.locator("li")).toHaveCount(2);
    await expect(history.getByText("Опечатка", { exact: true })).toHaveCount(1);
    await expect(history.getByText("Ошибка проигнорирована", { exact: true })).toBeVisible();
  });

  test("opens an encoded Japanese character route without double encoding the API lookup", async ({
    page,
  }) => {
    await signIn(page);
    await mockItemApi(page);
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().startsWith(`${API_BASE_URL}/kanji/`)) requests.push(request.url());
    });
    await page.goto(`/kanji/${encodeURIComponent("一")}`);
    await expect(page.getByRole("heading", { name: "一", exact: true })).toBeVisible();
    expect(requests).toEqual([`${API_BASE_URL}/kanji/${encodeURIComponent("一")}`]);
  });

  test("opens an item page", async ({ page }) => {
    await signIn(page);
    await mockItemApi(page);

    await page.goto(`/items/${ITEM_ID}`);

    await expect(page.locator(".item-hero-main > .eyebrow")).toHaveText("Кандзи");
    await expect(page.getByRole("heading", { name: "一" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Значения" })).toBeVisible();
    const tabs = await page
      .getByRole("tablist", { name: "Разделы материала", exact: true })
      .boundingBox();
    expect(tabs).not.toBeNull();
    expect(tabs!.y + tabs!.height).toBeLessThan(await page.evaluate(() => innerHeight - 80));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath("item-study.png"), fullPage: true });
    await page.screenshot({ path: test.info().outputPath("material-first-viewport.png") });
    await expect(page.getByRole("heading", { name: "Глобальные ответы" })).toBeHidden();
    await page.getByText("Все допустимые ответы", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Глобальные ответы" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Порядок черт" })).toBeVisible();
    await expect(page.getByTestId("kanji-stroke-graphic")).toBeVisible();
    await expect(page.getByTestId("kanji-stroke-graphic").locator("path")).toHaveCount(1);
    const sources = page.getByRole("heading", { name: "Источники", exact: true }).locator("..");
    await page.getByRole("tab", { name: "Источники", exact: true }).click();
    await expect(sources.getByText("KANJIDIC2", { exact: true })).toBeVisible();
    await expect(sources.getByText("KanjiVG", { exact: true })).toBeVisible();
  });

  test("suggests mnemonic review for leech items", async ({ page }) => {
    await signIn(page);
    await mockItemApi(page);

    await page.goto(`/items/${ITEM_ID}`);

    await expect(page.getByTestId("item-leech-notice")).toContainText("Балл 29");
    await expect(page.getByTestId("item-leech-notice")).toContainText("мнемонику");
  });

  test("shows taught and dictionary readings with paginated SRS history", async ({ page }) => {
    await signIn(page);
    await mockItemApi(page);

    await page.goto(`/items/${ITEM_ID}`);

    const readings = page.getByTestId("kanji-reading-details");
    await expect(readings.getByText("Основное учебное чтение")).toBeVisible();
    await expect(readings.getByText("いち", { exact: true }).first()).toBeVisible();
    await readings.getByRole("button", { name: "Словарные чтения", exact: true }).click();
    await expect(readings.getByText("Онъёми")).toBeVisible();
    await expect(readings.getByText("Кунъёми")).toBeVisible();
    await page.getByRole("tab", { name: "История", exact: true }).click();

    const history = page.getByTestId("item-srs-history");
    await expect(history.getByText("Опечатка", { exact: true })).toBeVisible();
    await history.getByRole("button", { name: "Показать более ранние" }).click();
    await expect(history.getByText("Ошибка проигнорирована", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Изучение", exact: true }).click();
    await expect(page.getByText("Составляющие компоненты")).toBeVisible();
  });

  test("shows vocabulary evidence, kanji composition, and attributed examples", async ({
    page,
  }) => {
    await signIn(page);
    await page.route(`${API_BASE_URL}/items/${WORD_ID}`, async (route) => {
      await route.fulfill({ json: buildWordDetails() });
    });

    await page.goto(`/items/${WORD_ID}`);

    const details = page.getByTestId("word-study-details");
    await expect(details.getByText("がっこう", { exact: true })).toBeVisible();
    await expect(details.locator(".word-sense-list")).toBeHidden();
    await details.getByRole("button", { name: "Словарные значения", exact: true }).click();
    await expect(details.getByText(/существительное/).first()).toBeVisible();
    await expect(details.getByText("420", { exact: true })).toBeVisible();
    await expect(page.getByText("Составляющие кандзи")).toBeVisible();
    await expect(page.getByText("Project examples · LicenseRef-Project-Authored")).toBeVisible();
  });

  test("separates a component name and shape from its meaning", async ({ page }) => {
    await signIn(page);
    await page.route(`${API_BASE_URL}/items/${COMPONENT_ID}`, async (route) => {
      await route.fulfill({ json: buildComponentDetails() });
    });

    await page.goto(`/items/${COMPONENT_ID}`);

    await expect(page.getByRole("heading", { name: "Значения" })).toBeVisible();
    await expect(page.locator(".item-hero .item-translation-rows dd")).toHaveText(["один", "one"]);
    const details = page.getByTestId("component-details");
    await expect(details.getByText("единица / one", { exact: true })).toBeVisible();
    await expect(
      details.getByText("горизонтальная черта / horizontal stroke", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("одна черта", { exact: true })).toHaveCount(0);
  });

  test("uses persisted furigana and explicit romaji on words and examples with local reveal", async ({
    page,
  }, testInfo) => {
    await signIn(page, { lessonPronunciationMode: "furigana", lessonRomaji: true });
    await page.route(`${API_BASE_URL}/items/${WORD_ID}`, async (route) => {
      await route.fulfill({ json: buildWordDetails() });
    });
    await page.goto(`/items/${WORD_ID}`);
    await expect(page.locator(".item-hero-main ruby rt")).toHaveText("がっこう");
    await expect(page.locator(".example-list ruby rt")).toHaveText("がっこうへいきます。");
    await expect(page.locator(".item-hero").getByText("gakkou", { exact: true })).toBeVisible();
    await page.getByLabel("Скрыть подсказки чтения").check();
    await expect(page.locator(".item-hero-main ruby")).toHaveCount(0);
    await expect(page.locator(".example-list ruby")).toHaveCount(0);
    await expect(page.locator(".item-hero").getByText("gakkou", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Показать чтение", exact: true }).click();
    await expect(page.locator(".item-hero").getByText("がっこう", { exact: true })).toBeVisible();
    await expect(
      page.locator(".example-list").getByText("がっこうへいきます。", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Показать чтение примера", exact: true }).click();
    await expect(
      page.locator(".example-list").getByText("がっこうへいきます。", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Project examples · LicenseRef-Project-Authored")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Скрыть подсказки чтения")).not.toBeChecked();
    await expect(page.locator(".item-hero-main ruby rt")).toHaveText("がっこう");
    await page.screenshot({ path: testInfo.outputPath("item-reading-preferences.png") });
  });

  test("adds a private synonym", async ({ page }) => {
    await signIn(page);
    await mockItemApi(page);

    await page.goto(`/items/${ITEM_ID}`);
    const acceptedPanel = privatePanel(page, "Приватные ответы");
    await page.getByRole("tab", { name: "Мои записи", exact: true }).click();
    await page.getByTestId("private-answer-text").fill("единица");
    await page.getByTestId("private-answer-note").fill("Мой вариант из учебника.");
    await page.getByTestId("private-answer-submit").click();

    await expect(page.getByText("Приватный ответ сохранён.")).toBeVisible();
    await expect(
      acceptedPanel.locator(".private-override-list").getByText("единица"),
    ).toBeVisible();
    await expect(
      acceptedPanel.locator(".private-override-list").getByText("Мой вариант из учебника."),
    ).toBeVisible();
  });

  test("edits a private mnemonic", async ({ page }) => {
    await signIn(page);
    await mockItemApi(page);

    await page.goto(`/items/${ITEM_ID}`);
    const mnemonicPanel = privatePanel(page, "Приватная заметка");
    await page.getByRole("tab", { name: "Мои записи", exact: true }).click();
    await page.getByTestId("private-mnemonic-body").fill("Одна длинная горизонтальная линия.");
    await page.getByTestId("private-mnemonic-submit").click();

    await expect(page.getByText("Приватная заметка сохранена.")).toBeVisible();
    await expect(
      mnemonicPanel.locator(".lesson-text-list").getByText("Одна длинная горизонтальная линия."),
    ).toBeVisible();

    await page.getByTestId("private-mnemonic-body").fill("Один чистый штрих.");
    await page.getByTestId("private-mnemonic-submit").click();

    await expect(
      mnemonicPanel.locator(".lesson-text-list").getByText("Один чистый штрих."),
    ).toBeVisible();
  });

  test("preserves a synonym when replacement fails and retries with one PUT", async ({ page }) => {
    await signIn(page);
    const original = buildOverride("original", "единица");
    const mock = await mockItemApi(page, { overrides: [original], failReplacement: true });
    await page.goto(`/items/${ITEM_ID}`);
    const panel = privatePanel(page, "Приватные ответы");
    await page.getByRole("tab", { name: "Мои записи", exact: true }).click();
    await panel.getByRole("button", { name: "Изменить", exact: true }).click();
    await page.getByTestId("private-answer-text").fill("единичка");
    await page.getByTestId("private-answer-submit").click();
    await expect(page.locator(".item-page").getByRole("alert")).toHaveText("Replacement failed");
    expect(mock.privateOverrides).toEqual([original]);
    expect(mock.overrideDeletes).toEqual([]);
    await page.reload();
    await page.getByRole("tab", { name: "Мои записи", exact: true }).click();
    await expect(panel.locator(".private-override-list strong")).toHaveText("единица");
    await panel.getByRole("button", { name: "Изменить", exact: true }).click();
    await page.getByTestId("private-answer-text").fill("единичка");
    await page.getByTestId("private-answer-submit").click();
    await expect(panel.locator(".private-override-list strong")).toHaveText("единичка");
    expect(mock.privateOverrides).toMatchObject([{ id: original.id, text: "единичка" }]);
    expect(mock.replacementMethods).toEqual(["PUT", "PUT"]);
    expect(mock.overrideDeletes).toEqual([]);
  });

  test("loads exact mnemonic locale/type, retains drafts, and preserves other stored notes", async ({
    page,
  }) => {
    await signIn(page);
    // Editing remains independent of the learning-content display filter.
    await page.addInitScript(() =>
      window.localStorage.setItem("kanji-srs.translationDisplayMode", "ru"),
    );
    const originals = (["ru-RU", "en-US"] as const).flatMap((locale) =>
      (["story", "meaning", "reading"] as const).map((mnemonicType) =>
        buildMnemonic(locale, mnemonicType),
      ),
    );
    const mock = await mockItemApi(page, { mnemonics: originals });
    await page.goto(`/items/${ITEM_ID}`);
    const form = page.getByTestId("private-mnemonic-form");
    const body = page.getByTestId("private-mnemonic-body");
    await page.getByRole("tab", { name: "Мои записи", exact: true }).click();
    await expect(body).toHaveValue("ru-RU:story");
    await body.fill("unsaved RU story");
    await page.getByRole("tab", { name: "Изучение", exact: true }).click();
    await expect(body).toBeHidden();
    await page.getByRole("tab", { name: "Изучение", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Мои записи", exact: true })).toBeFocused();
    await expect(body).toHaveValue("unsaved RU story");
    await form.getByRole("combobox", { name: "Язык", exact: true }).selectOption("en-US");
    await expect(body).toHaveValue("en-US:story");
    await form.getByRole("combobox", { name: "Тип", exact: true }).selectOption("reading");
    await expect(body).toHaveValue("en-US:reading");
    await body.fill("updated EN reading");
    await form.getByRole("combobox", { name: "Язык", exact: true }).selectOption("ru-RU");
    await expect(body).toHaveValue("ru-RU:reading");
    await form.getByRole("combobox", { name: "Тип", exact: true }).selectOption("story");
    await expect(body).toHaveValue("unsaved RU story");
    await form.getByRole("combobox", { name: "Язык", exact: true }).selectOption("en-US");
    await form.getByRole("combobox", { name: "Тип", exact: true }).selectOption("reading");
    await expect(body).toHaveValue("updated EN reading");
    await page.getByTestId("private-mnemonic-submit").click();
    await expect(page.getByText("Приватная заметка сохранена.")).toBeVisible();
    expect(mock.mnemonics.filter((note) => note.body !== "updated EN reading")).toEqual(
      originals.filter((note) => note.locale !== "en-US" || note.mnemonicType !== "reading"),
    );
    await page.reload();
    await page.getByRole("tab", { name: "Мои записи", exact: true }).click();
    await expect(body).toHaveValue("ru-RU:story");
    await form.getByRole("combobox", { name: "Язык", exact: true }).selectOption("en-US");
    await form.getByRole("combobox", { name: "Тип", exact: true }).selectOption("reading");
    await expect(body).toHaveValue("updated EN reading");
    await form.getByRole("button", { name: "Удалить заметку", exact: true }).click();
    await expect(body).toHaveValue("");
    expect(mock.mnemonics).toEqual(
      originals.filter((note) => note.locale !== "en-US" || note.mnemonicType !== "reading"),
    );
  });
});

function privatePanel(page: Page, heading: string) {
  return page.locator(".item-side .panel").filter({
    has: page.getByRole("heading", { name: heading }),
  });
}

async function signIn(
  page: Page,
  preferences: {
    lessonPronunciationMode?: "kana" | "furigana";
    lessonRomaji?: boolean;
    translationDisplayMode?: "ru" | "en" | "ru-en";
    speechAutoplay?: boolean;
    speechRate?: number;
  } = {},
): Promise<void> {
  await page.route(`${API_BASE_URL}/items/*/private-mnemonics`, async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.addInitScript(
    ({ accessToken, preferences }) => {
      window.localStorage.setItem("kanji-srs.accessToken", accessToken);
      window.localStorage.setItem(
        "kanji-srs.translationDisplayMode",
        preferences.translationDisplayMode ?? "ru-en",
      );
      window.localStorage.setItem(
        "kanji-srs.user",
        JSON.stringify({
          id: "user-1",
          email: "learner@example.test",
          displayName: "Тестовый ученик",
          role: "USER",
          settings: {
            locale: "ru-RU",
            translationDisplayMode: "ru-en",
            timezone: "Europe/Moscow",
            dailyLessonLimit: 20,
            reviewBudget: 100,
            strictMode: false,
            ...preferences,
          },
        }),
      );
    },
    { accessToken: ACCESS_TOKEN, preferences },
  );
}

async function mockItemApi(
  page: Page,
  options: {
    readonly overrides?: readonly UserOverrideDto[];
    readonly mnemonics?: readonly UserMnemonicDto[];
    readonly failReplacement?: boolean;
  } = {},
) {
  const privateOverrides = [...(options.overrides ?? [])];
  const mnemonics = [...(options.mnemonics ?? [])];
  const overrideDeletes: string[] = [];
  const replacementMethods: string[] = [];
  let failReplacement = options.failReplacement ?? false;
  const details = (): ItemDetails => {
    const item = buildItemDetails(privateOverrides, null);
    return {
      ...item,
      mnemonics: {
        ru: [
          ...item.mnemonics.ru,
          ...mnemonics
            .filter((note) => note.locale === "ru-RU")
            .map((note) => ({ locale: note.locale, text: note.body, sourceKind: "user" as const })),
        ],
        en: mnemonics
          .filter((note) => note.locale === "en-US")
          .map((note) => ({ locale: note.locale, text: note.body, sourceKind: "user" as const })),
      },
    };
  };

  await page.route(`${API_BASE_URL}/confusables?itemId=*`, async (route) => {
    await route.fulfill({ json: { pairs: [] } });
  });

  await page.route(`${API_BASE_URL}/items/${ITEM_ID}`, async (route) => {
    await route.fulfill({
      json: details(),
    });
  });

  await page.route(`${API_BASE_URL}/kanji/${encodeURIComponent("一")}`, async (route) => {
    await route.fulfill({
      json: details(),
    });
  });

  await page.route(`${API_BASE_URL}/items/${ITEM_ID}/history?cursor=older`, async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            id: "history-older",
            learningCardId: "card-kanji-one-meaning",
            promptType: "meaning",
            answerType: "meaning",
            result: "manual-ignore",
            previousStageIndex: 2,
            nextStageIndex: 2,
            answeredAt: "2026-06-21T08:00:00.000Z",
          },
        ],
        nextCursor: null,
      },
    });
  });

  await page.route(`${API_BASE_URL}/cards/card-kanji-one-meaning/overrides`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly text?: string;
      readonly locale?: ContentLocale;
      readonly note?: string | null;
    };
    const override: UserOverrideDto = {
      id: `override-${privateOverrides.length + 1}`,
      learningCardId: "card-kanji-one-meaning",
      kind: "accepted-answer",
      locale: body.locale ?? "ru-RU",
      text: body.text ?? "",
      normalizedText: body.text ?? "",
      note: body.note ?? null,
      createdAt: "2026-06-22T08:01:00.000Z",
      updatedAt: "2026-06-22T08:01:00.000Z",
    };
    privateOverrides.push(override);

    await route.fulfill({ json: override });
  });

  await page.route(`${API_BASE_URL}/cards/card-kanji-one-meaning/overrides/*`, async (route) => {
    const id = route.request().url().split("/").at(-1)!;
    const index = privateOverrides.findIndex((entry) => entry.id === id);
    if (route.request().method() === "DELETE") {
      overrideDeletes.push(id);
      if (index !== -1) privateOverrides.splice(index, 1);
      await route.fulfill({ json: { deleted: true } });
      return;
    }
    replacementMethods.push(route.request().method());
    if (failReplacement) {
      failReplacement = false;
      await route.fulfill({ status: 503, json: { message: "Replacement failed" } });
      return;
    }
    const input = route.request().postDataJSON() as {
      text: string;
      locale: ContentLocale;
      note: string | null;
    };
    const updated = { ...privateOverrides[index]!, ...input, normalizedText: input.text };
    privateOverrides[index] = updated;
    await route.fulfill({ json: updated });
  });

  await page.route(`${API_BASE_URL}/items/${ITEM_ID}/private-mnemonics`, async (route) => {
    await route.fulfill({ json: mnemonics });
  });

  await page.route(`${API_BASE_URL}/items/${ITEM_ID}/private-mnemonic`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly body?: string;
      readonly locale?: ContentLocale;
      readonly mnemonicType?: UserMnemonicDto["mnemonicType"];
    };
    const index = mnemonics.findIndex(
      (note) => note.locale === body.locale && note.mnemonicType === body.mnemonicType,
    );
    if (route.request().method() === "DELETE") {
      if (index !== -1) mnemonics.splice(index, 1);
      await route.fulfill({ json: { deleted: true } });
      return;
    }

    const privateMnemonic: UserMnemonicDto = {
      id: "mnemonic-1",
      learningItemId: ITEM_ID,
      locale: body.locale ?? "ru-RU",
      mnemonicType: body.mnemonicType ?? "story",
      body: body.body ?? "",
      createdAt: "2026-06-22T08:02:00.000Z",
      updatedAt: "2026-06-22T08:03:00.000Z",
    };
    if (index === -1) mnemonics.push(privateMnemonic);
    else mnemonics[index] = privateMnemonic;

    await route.fulfill({ json: { mnemonic: privateMnemonic } });
  });
  return { privateOverrides, mnemonics, overrideDeletes, replacementMethods };
}

function buildOverride(id: string, text: string): UserOverrideDto {
  return {
    id,
    text,
    normalizedText: text,
    learningCardId: "card-kanji-one-meaning",
    kind: "accepted-answer",
    locale: "ru-RU",
    note: null,
    createdAt: "2026-06-22T08:00:00.000Z",
    updatedAt: "2026-06-22T08:00:00.000Z",
  };
}

function buildMnemonic(
  locale: ContentLocale,
  mnemonicType: UserMnemonicDto["mnemonicType"],
): UserMnemonicDto {
  return {
    id: `${locale}:${mnemonicType}`,
    learningItemId: ITEM_ID,
    locale,
    mnemonicType,
    body: `${locale}:${mnemonicType}`,
    createdAt: "2026-06-22T08:00:00.000Z",
    updatedAt: "2026-06-22T08:00:00.000Z",
  };
}

function buildItemDetails(
  privateOverrides: readonly UserOverrideDto[],
  privateMnemonic: UserMnemonicDto | null,
): ItemDetails {
  return {
    id: ITEM_ID,
    itemType: "kanji",
    slug: "kanji:一",
    japanese: "一",
    reading: "いち",
    translations: {
      displayMode: "ru-en",
      primaryRu: "один",
      primaryEn: "one",
      ru: [{ locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" }],
      en: [{ locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" }],
    },
    componentDetails: null,
    kanjiDetails: {
      primaryTaughtReading: {
        locale: "ru-RU",
        text: "いち",
        isPrimary: true,
        sourceKind: "curated",
      },
      additionalAcceptedReadings: [],
      readingEvidence: [
        {
          reading: "いち",
          readingType: "on",
          priority: 10,
          sourceKind: "imported",
        },
        {
          reading: "ひと",
          readingType: "kun",
          priority: 5,
          sourceKind: "imported",
        },
      ],
    },
    wordDetails: null,
    level: 1,
    jlptLevel: "N5",
    srs: {
      stageIndex: 4,
      stageName: "Apprentice 4",
      availableAt: "2026-06-24T15:00:00.000Z",
      burnedAt: null,
      wrongCount: 8,
      correctStreak: 1,
      leech: {
        score: 29,
        isCandidate: true,
        wrongCount: 8,
        correctStreak: 1,
        recentWrongCount: 2,
        stageDropCount: 1,
        stageDropMagnitude: 4,
        reasons: ["wrong-count", "recent-wrong", "stage-instability"],
      },
    },
    nextReviewAt: "2026-06-24T15:00:00.000Z",
    reviewHistory: {
      items: [
        {
          id: "history-newest",
          learningCardId: "card-kanji-one-reading",
          promptType: "reading",
          answerType: "reading",
          result: "typo",
          previousStageIndex: 4,
          nextStageIndex: 4,
          answeredAt: "2026-06-22T08:00:00.000Z",
        },
      ],
      nextCursor: "older",
    },
    strokeGraphic: {
      sourceRecordId: "kanjivg:04e00",
      viewBox: "0 0 109 109",
      strokes: [
        {
          id: "kvg:04e00-s1",
          order: 1,
          path: "M18,54 C34,52 72,52 91,54",
          type: "㇐",
        },
      ],
    },
    cards: [
      {
        id: "card-kanji-one-meaning",
        learningItemId: ITEM_ID,
        itemType: "kanji",
        cardType: "review",
        promptType: "meaning",
        answerType: "meaning",
        translationDisplayMode: "ru-en",
        prompt: { japanese: "一", reading: "いち" },
        translations: {
          displayMode: "ru-en",
          primaryRu: "один",
          primaryEn: "one",
          ru: [{ locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" }],
          en: [{ locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" }],
        },
        acceptedAnswers: [
          { locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" },
          { locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" },
        ],
        blockedAnswers: [{ locale: "ru-RU", text: "линия", sourceKind: "curated" }],
        sortOrder: 1,
      },
      {
        id: "card-kanji-one-reading",
        learningItemId: ITEM_ID,
        itemType: "kanji",
        cardType: "review",
        promptType: "reading",
        answerType: "reading",
        translationDisplayMode: "ru-en",
        prompt: { japanese: "一", reading: "いち" },
        translations: {
          displayMode: "ru-en",
          primaryRu: "один",
          primaryEn: "one",
          ru: [{ locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" }],
          en: [{ locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" }],
        },
        acceptedAnswers: [
          { locale: "ru-RU", text: "いち", isPrimary: true, sourceKind: "curated" },
        ],
        blockedAnswers: [],
        sortOrder: 2,
      },
    ],
    relations: [
      {
        relationType: "dependency",
        item: {
          id: "item-component-one",
          itemType: "component",
          slug: "component:一",
          japanese: "一",
          reading: null,
          translations: {
            displayMode: "ru-en",
            primaryRu: "компонент один",
            primaryEn: "one component",
            ru: [
              {
                locale: "ru-RU",
                text: "компонент один",
                isPrimary: true,
                sourceKind: "curated",
              },
            ],
            en: [
              {
                locale: "en-US",
                text: "one component",
                isPrimary: true,
                sourceKind: "curated",
              },
            ],
          },
          level: 1,
          jlptLevel: null,
          srs: null,
        },
      },
    ],
    relationGroups: [
      {
        kind: "components",
        total: 1,
        items: [
          {
            id: "item-component-one",
            itemType: "component",
            slug: "component:一",
            japanese: "一",
            reading: null,
            translations: {
              displayMode: "ru-en",
              primaryRu: "компонент один",
              primaryEn: "one component",
              ru: [
                {
                  locale: "ru-RU",
                  text: "компонент один",
                  isPrimary: true,
                  sourceKind: "curated",
                },
              ],
              en: [
                {
                  locale: "en-US",
                  text: "one component",
                  isPrimary: true,
                  sourceKind: "curated",
                },
              ],
            },
            level: 1,
            jlptLevel: null,
            srs: null,
          },
        ],
      },
    ],
    mnemonics: {
      ru: [
        {
          locale: "ru-RU",
          text: "Один предмет легко представить как один штрих.",
          sourceKind: "curated",
        },
        ...(privateMnemonic === null || privateMnemonic.locale !== "ru-RU"
          ? []
          : [
              { locale: "ru-RU" as const, text: privateMnemonic.body, sourceKind: "user" as const },
            ]),
      ],
      en:
        privateMnemonic === null || privateMnemonic.locale !== "en-US"
          ? []
          : [{ locale: "en-US", text: privateMnemonic.body, sourceKind: "user" }],
    },
    hints: {
      ru: [
        {
          locale: "ru-RU",
          text: "Для базового счёта используйте чтение いち.",
          sourceKind: "curated",
        },
      ],
      en: [],
    },
    exampleSentences: [
      {
        id: "sentence-1",
        japaneseText: "一つください。",
        readingText: "ひとつください。",
        translationRu: "Дайте один, пожалуйста.",
        translationEn: "One, please.",
        difficulty: 1,
        attribution: null,
      },
    ],
    attributions: [
      {
        sourceName: "KANJIDIC2",
        licenseName: "CC BY-SA 4.0",
        attributionText: "EDRDG kanji metadata.",
        sourceUrl: "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project",
      },
      {
        sourceName: "KanjiVG",
        licenseName: "LicenseRef-KanjiVG",
        attributionText: "Stroke order data is derived from KanjiVG.",
        sourceUrl: "https://kanjivg.tagaini.net/",
      },
    ],
    userOverrides: privateOverrides,
  };
}

function buildComponentDetails(): ItemDetails {
  const item = buildItemDetails([], null);

  return {
    ...item,
    id: COMPONENT_ID,
    itemType: "component",
    slug: "component:一",
    japanese: "一",
    reading: null,
    translations: {
      displayMode: "ru-en",
      primaryRu: "один",
      primaryEn: "one",
      ru: [{ locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" }],
      en: [{ locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" }],
    },
    componentDetails: {
      name: {
        displayMode: "ru-en",
        primaryRu: "единица",
        primaryEn: "one",
        ru: [{ locale: "ru-RU", text: "единица", isPrimary: true, sourceKind: "curated" }],
        en: [{ locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" }],
      },
      shapeDescription: {
        displayMode: "ru-en",
        primaryRu: "горизонтальная черта",
        primaryEn: "horizontal stroke",
        ru: [
          {
            locale: "ru-RU",
            text: "горизонтальная черта",
            isPrimary: true,
            sourceKind: "curated",
          },
        ],
        en: [
          {
            locale: "en-US",
            text: "horizontal stroke",
            isPrimary: true,
            sourceKind: "curated",
          },
        ],
      },
    },
    kanjiDetails: null,
    wordDetails: null,
    jlptLevel: null,
    srs: null,
    nextReviewAt: null,
    reviewHistory: { items: [], nextCursor: null },
    strokeGraphic: null,
    cards: [],
    relations: [],
    relationGroups: [],
    mnemonics: { ru: [], en: [] },
    hints: { ru: [], en: [] },
    exampleSentences: [],
    attributions: [],
    userOverrides: [],
  };
}

function buildWordDetails(): ItemDetails {
  const item = buildItemDetails([], null);
  const kanjiSummary = {
    id: ITEM_ID,
    itemType: "kanji" as const,
    slug: "kanji:一",
    japanese: "学",
    reading: "がく",
    translations: {
      displayMode: "ru-en" as const,
      primaryRu: "учёба",
      primaryEn: "study",
      ru: [
        {
          locale: "ru-RU" as const,
          text: "учёба",
          isPrimary: true,
          sourceKind: "curated" as const,
        },
      ],
      en: [
        {
          locale: "en-US" as const,
          text: "study",
          isPrimary: true,
          sourceKind: "curated" as const,
        },
      ],
    },
    level: 2,
    jlptLevel: "N5",
    srs: null,
  };

  return {
    ...item,
    id: WORD_ID,
    itemType: "word",
    slug: "word:学校",
    japanese: "学校",
    reading: "がっこう",
    translations: {
      displayMode: "ru-en",
      primaryRu: "школа",
      primaryEn: "school",
      ru: [{ locale: "ru-RU", text: "школа", isPrimary: true, sourceKind: "curated" }],
      en: [{ locale: "en-US", text: "school", isPrimary: true, sourceKind: "curated" }],
    },
    componentDetails: null,
    kanjiDetails: null,
    wordDetails: {
      reading: "がっこう",
      commonnessRank: 420,
      senses: [
        {
          locale: "ru-RU",
          meaning: "школа",
          partOfSpeech: "noun",
          register: null,
          tags: ["common"],
          sourceKind: "imported",
        },
        {
          locale: "en-US",
          meaning: "school",
          partOfSpeech: "noun",
          register: null,
          tags: ["common"],
          sourceKind: "imported",
        },
      ],
    },
    strokeGraphic: null,
    cards: [],
    relations: [{ relationType: "kanji", item: kanjiSummary }],
    relationGroups: [{ kind: "kanji", items: [kanjiSummary], total: 1 }],
    reviewHistory: { items: [], nextCursor: null },
    exampleSentences: [
      {
        id: "sentence-school",
        japaneseText: "学校へ行きます。",
        readingText: "がっこうへいきます。",
        translationRu: "Я иду в школу.",
        translationEn: "I go to school.",
        difficulty: 1,
        attribution: {
          sourceName: "Project examples",
          licenseName: "LicenseRef-Project-Authored",
          attributionText: "Project-authored example.",
          sourceUrl: null,
        },
      },
    ],
    attributions: [
      {
        sourceName: "JMdict",
        licenseName: "CC BY-SA 4.0",
        attributionText: "EDRDG lexical metadata.",
        sourceUrl: "https://www.edrdg.org/jmdict/j_jmdict.html",
      },
    ],
    userOverrides: [],
  };
}
