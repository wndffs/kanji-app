import { ItemDetailsClient } from "../../items/ItemDetailsClient";
import { decodeItemRouteParameter } from "../../../lib/item-route";
import Link from "next/link";
import { characterCatalogueReturnHref } from "../../../lib/character-catalogue-context";

type KanjiPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
  readonly params: Promise<{
    readonly character: string;
  }>;
};

export default async function KanjiPage({ params, searchParams }: KanjiPageProps) {
  const { character } = await params;
  const returnHref = characterCatalogueReturnHref((await searchParams).catalogue);

  return (
    <>
      {returnHref === null ? null : <Link className="course-return-link" href={returnHref}>К каталогу кандзи</Link>}
      <ItemDetailsClient lookup={{ type: "kanji", value: decodeItemRouteParameter(character) }} />
    </>
  );
}
