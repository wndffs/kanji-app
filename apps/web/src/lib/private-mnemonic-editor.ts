import { type ContentLocale, type UserMnemonicDto } from "@kanji-srs/shared";

export type MnemonicSelection = {
  readonly locale: ContentLocale;
  readonly mnemonicType: UserMnemonicDto["mnemonicType"];
};

export type MnemonicFormState = MnemonicSelection & {
  readonly body: string;
  readonly drafts: Readonly<Record<string, string>>;
};

export function mnemonicKey(selection: MnemonicSelection): string {
  return `${selection.locale}:${selection.mnemonicType}`;
}

export function resolveMnemonicForm(
  form: MnemonicFormState,
  mnemonics: readonly UserMnemonicDto[],
): MnemonicFormState {
  const existing = mnemonics.find(
    (mnemonic) => mnemonic.locale === form.locale && mnemonic.mnemonicType === form.mnemonicType,
  );
  return { ...form, body: form.drafts[mnemonicKey(form)] ?? existing?.body ?? "" };
}

export function editMnemonicBody(form: MnemonicFormState, body: string): MnemonicFormState {
  return { ...form, body, drafts: { ...form.drafts, [mnemonicKey(form)]: body } };
}

export function selectMnemonicForm(
  form: MnemonicFormState,
  selection: MnemonicSelection,
  mnemonics: readonly UserMnemonicDto[],
): MnemonicFormState {
  return resolveMnemonicForm(
    {
      ...editMnemonicBody(form, form.body),
      locale: selection.locale,
      mnemonicType: selection.mnemonicType,
    },
    mnemonics,
  );
}
