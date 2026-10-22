import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const NON_RUNTIME_ROOT_FILES = new Set(["AGENTS.md", "README.md", "LICENSE", "LICENSE.md"]);

export function containsOnlyNonRuntimeChanges(paths) {
  return (
    paths.length > 0 &&
    paths.every((path) => {
      if (
        typeof path !== "string" ||
        !path ||
        /[\\\r\n\0]/u.test(path) ||
        path.startsWith("/") ||
        path.split("/").includes("..")
      )
        return false;
      return (
        NON_RUNTIME_ROOT_FILES.has(path) ||
        ["docs/", "prompts/", ".github/", ".codex/", "apps/web/e2e/", "apps/api/test/"].some(
          (prefix) => path.startsWith(prefix),
        ) ||
        /^packages\/[^/]+\/test\//u.test(path) ||
        /^scripts\/[^/]+\.test\.ts$/u.test(path)
      );
    })
  );
}

export function ignoredBuildExitCode({ env = process.env, git = spawnSync } = {}) {
  const previous = env.VERCEL_GIT_PREVIOUS_SHA;
  if (env.KANJI_FORCE_DEPLOY === "1" || !/^[a-f0-9]{40,64}$/iu.test(previous ?? "")) return 1;
  const options = { encoding: "utf8", shell: false, timeout: 10_000, maxBuffer: 1_048_576 };
  try {
    // A rollback, missing shallow history or failed diff must always build.
    if (git("git", ["merge-base", "--is-ancestor", previous, "HEAD"], options).status !== 0)
      return 1;
    const diff = git(
      "git",
      ["diff", "--name-only", "--no-renames", "-z", previous, "HEAD", "--"],
      options,
    );
    if (diff.status !== 0 || typeof diff.stdout !== "string" || !diff.stdout.endsWith("\0"))
      return 1;
    return containsOnlyNonRuntimeChanges(diff.stdout.slice(0, -1).split("\0")) ? 0 : 1;
  } catch {
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const code = ignoredBuildExitCode();
  console.log(code === 0 ? "Skipping non-runtime-only changes." : "Continuing deployment build.");
  process.exitCode = code;
}
