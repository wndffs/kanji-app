import { parseDeploymentRevision } from "@kanji-srs/shared";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    {
      ok: true,
      service: "web",
      revision: parseDeploymentRevision(process.env.VERCEL_GIT_COMMIT_SHA),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
