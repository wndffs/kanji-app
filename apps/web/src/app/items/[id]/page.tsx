import { ItemDetailsClient } from "../ItemDetailsClient";
import Link from "next/link";
import { courseReturnHref } from "../../../lib/course-browser-route";

type ItemPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
  readonly params: Promise<{
    readonly id: string;
  }>;
};

export default async function ItemPage({ params, searchParams }: ItemPageProps) {
  const { id } = await params;

  const returnHref = courseReturnHref(await searchParams);
  return (
    <>
      {returnHref === null ? null : (
        <Link className="course-return-link" href={returnHref}>
          К материалам уровня
        </Link>
      )}
      <ItemDetailsClient lookup={{ type: "item", value: id }} />
    </>
  );
}
