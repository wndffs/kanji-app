import { ItemDetailsClient } from "../../items/ItemDetailsClient";
import { decodeItemRouteParameter } from "../../../lib/item-route";

type KanjiPageProps = {
  readonly params: Promise<{
    readonly character: string;
  }>;
};

export default async function KanjiPage({ params }: KanjiPageProps) {
  const { character } = await params;

  return (
    <ItemDetailsClient lookup={{ type: "kanji", value: decodeItemRouteParameter(character) }} />
  );
}
