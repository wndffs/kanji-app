import { ItemDetailsClient } from "../../items/ItemDetailsClient";

type KanjiPageProps = {
  readonly params: Promise<{
    readonly character: string;
  }>;
};

export default async function KanjiPage({ params }: KanjiPageProps) {
  const { character } = await params;

  return <ItemDetailsClient lookup={{ type: "kanji", value: character }} />;
}
