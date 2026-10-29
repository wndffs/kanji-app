import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import { withNeonConnectionDefaults } from "../src/connection-defaults";
import {
  buildFoundationPilotManifest,
  buildFoundationPilotManifestV2,
  buildFoundationPilotManifestV3,
  buildFoundationPilotManifestV4,
  buildFoundationPilotManifestV5,
  buildFoundationPilotManifestV6,
  foundationPilotRecordId,
  planFoundationPilot,
  publishFoundationPilot,
} from "../src/foundation-pilot";

export function parseFoundationPilotArgs(args: readonly string[]): {
  mode: "validate-only" | "plan" | "publish";
  enrollUserId?: string;
  pilot?: "v1" | "v2" | "v3" | "v4" | "v5" | "v6";
} {
  let mode: "validate-only" | "plan" | "publish" | undefined;
  let enrollUserId: string | undefined;
  let pilot: "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--pilot") {
      const value = args[index + 1];
      if (
        pilot !== undefined ||
        (value !== "v1" &&
          value !== "v2" &&
          value !== "v3" &&
          value !== "v4" &&
          value !== "v5" &&
          value !== "v6")
      )
        throw new Error("Provide --pilot once with v1, v2, v3, v4, v5 or v6.");
      pilot = value;
      index++;
    } else if (arg === "--enroll-user-id") {
      const id = args[index + 1];
      if (
        enrollUserId !== undefined ||
        id === undefined ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(id)
      )
        throw new Error("Provide --enroll-user-id once with one explicit UUID.");
      enrollUserId = id;
      index++;
    } else if (arg === "--validate-only" || arg === "--plan" || arg === "--publish") {
      if (mode !== undefined)
        throw new Error("Choose one publication mode; duplicate mode flags are not allowed.");
      mode = arg === "--validate-only" ? "validate-only" : arg === "--plan" ? "plan" : "publish";
    } else {
      throw new Error(
        "Supported flags: --validate-only, --plan, --publish, --enroll-user-id UUID, --pilot v1|v2|v3|v4|v5|v6.",
      );
    }
  }
  if (mode === "validate-only" && enrollUserId !== undefined)
    throw new Error(
      "--enroll-user-id requires database planning or publication, not --validate-only.",
    );
  return {
    mode: mode ?? "plan",
    ...(enrollUserId === undefined ? {} : { enrollUserId }),
    ...(pilot === undefined ? {} : { pilot }),
  };
}

async function main(): Promise<void> {
  const { mode, enrollUserId, pilot } = parseFoundationPilotArgs(process.argv.slice(2));
  const manifest =
    pilot === "v6"
      ? buildFoundationPilotManifestV6()
      : pilot === "v5"
        ? buildFoundationPilotManifestV5()
        : pilot === "v4"
          ? buildFoundationPilotManifestV4()
          : pilot === "v3"
            ? buildFoundationPilotManifestV3()
            : pilot === "v2"
              ? buildFoundationPilotManifestV2()
              : buildFoundationPilotManifest();
  const manifestRecordId = foundationPilotRecordId(manifest);
  if (mode === "validate-only") {
    console.log(
      JSON.stringify(
        {
          status: "valid-finite-manifest",
          slug: manifest.slug,
          counts: manifest.counts,
          levels: manifest.levels.length,
          manifestRecordId,
          sources: manifest.sources.map(({ records: _records, ...source }) => source),
        },
        null,
        2,
      ),
    );
    return;
  }
  if (manifest.sources.some((source) => source.reviewedAt === null))
    throw new Error(
      "All selected source batches require independent parent review before database planning or publication.",
    );
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error("DATABASE_URL is required for the read-only database plan or publication.");
  const prisma = new PrismaClient({ datasourceUrl: withNeonConnectionDefaults(url) });
  try {
    const options = { manifest, ...(enrollUserId === undefined ? {} : { enrollUserId }) };
    const result =
      mode === "publish"
        ? await publishFoundationPilot(prisma, options)
        : await planFoundationPilot(prisma, options);
    console.log(
      JSON.stringify(
        mode === "publish"
          ? result
          : {
              status: "read-only-plan",
              slug: manifest.slug,
              counts: manifest.counts,
              contentVersion: "contentVersion" in result ? result.contentVersion : undefined,
              existingPilotId: "existingPilotId" in result ? result.existingPilotId : undefined,
              manifestRecordId,
              enrollUserId: enrollUserId ?? null,
            },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
