import { describe, expect, it } from "vitest";
import { type UserMnemonicDto } from "@kanji-srs/shared";
import {
  editMnemonicBody,
  resolveMnemonicForm,
  selectMnemonicForm,
  type MnemonicFormState,
} from "../src/lib/private-mnemonic-editor";

const notes: readonly UserMnemonicDto[] = (["ru-RU", "en-US"] as const).flatMap((locale) =>
  (["story", "meaning", "reading"] as const).map((mnemonicType) => ({
    id: `${locale}:${mnemonicType}`,
    learningItemId: "item-one",
    locale,
    mnemonicType,
    body: `${locale}:${mnemonicType}`,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  })),
);
const empty: MnemonicFormState = { locale: "ru-RU", mnemonicType: "story", body: "", drafts: {} };

describe("private mnemonic editor", () => {
  it("loads the exact locale and type, independently of learning-content display mode", () => {
    let form = resolveMnemonicForm(empty, notes);
    for (const note of notes) {
      form = selectMnemonicForm(form, note, notes);
      expect(form.body).toBe(note.body);
    }
  });

  it("never carries a previous entry into a missing locale/type", () => {
    const form = selectMnemonicForm(
      resolveMnemonicForm(empty, notes),
      {
        locale: "en-US",
        mnemonicType: "reading",
      },
      notes.filter((note) => note.locale !== "en-US"),
    );
    expect(form.body).toBe("");
  });

  it("keeps unsaved drafts isolated by locale and type without modifying stored notes", () => {
    const snapshot = structuredClone(notes);
    let form = editMnemonicBody(resolveMnemonicForm(empty, notes), "RU draft");
    form = selectMnemonicForm(form, { locale: "en-US", mnemonicType: "reading" }, notes);
    expect(form.body).toBe("en-US:reading");
    form = editMnemonicBody(form, "EN draft");
    form = selectMnemonicForm(form, empty, notes);
    expect(form.body).toBe("RU draft");
    form = selectMnemonicForm(form, { locale: "en-US", mnemonicType: "reading" }, notes);
    expect(form.body).toBe("EN draft");
    expect(notes).toEqual(snapshot);
  });
});
