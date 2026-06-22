import { ItemDetailsClient } from "../ItemDetailsClient";

type ItemPageProps = {
  readonly params: Promise<{
    readonly id: string;
  }>;
};

export default async function ItemPage({ params }: ItemPageProps) {
  const { id } = await params;

  return <ItemDetailsClient lookup={{ type: "item", value: id }} />;
}
