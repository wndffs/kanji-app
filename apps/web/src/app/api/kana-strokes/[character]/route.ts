import { buildKanjiVgSourceUrl } from "../../../../lib/kana-tracing";

export async function GET(
  _request: Request,
  context: { readonly params: Promise<{ readonly character: string }> },
): Promise<Response> {
  const { character } = await context.params;
  const sourceUrl = buildKanjiVgSourceUrl(character);

  if (sourceUrl === null) {
    return Response.json(
      { message: "Поддерживается один знак хираганы или катаканы." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(sourceUrl, { next: { revalidate: 604_800 } });

    if (!response.ok) {
      return Response.json(
        { message: "Данные порядка черт временно недоступны." },
        { status: 502 },
      );
    }

    return new Response(await response.text(), {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
        "Content-Type": "image/svg+xml; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-KanjiVG-Source": sourceUrl,
      },
    });
  } catch {
    return Response.json({ message: "Данные порядка черт временно недоступны." }, { status: 502 });
  }
}
