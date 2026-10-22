import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { clearTimeout, setTimeout } from "node:timers";
import { setTimeout as wait } from "node:timers/promises";

const port = Number(process.env.WEB_SMOKE_PORT ?? 3100);
const hostname = process.env.WEB_SMOKE_HOST ?? "127.0.0.1";
const baseURL = `http://${hostname}:${port}`;
const isWindows = process.platform === "win32";
const playwrightArgs = process.argv.slice(2);
const require = createRequire(import.meta.url);
const suiteTimeoutMs = Number(process.env.WEB_SMOKE_TIMEOUT_MS ?? 600_000);
if (!Number.isInteger(suiteTimeoutMs) || suiteTimeoutMs < 1) {
  throw new Error("WEB_SMOKE_TIMEOUT_MS must be a positive integer.");
}

const server = spawnNodeCli(
  "next/dist/bin/next",
  ["dev", "--webpack", "--port", String(port), "--hostname", hostname],
  {
    WEB_SMOKE_HOST: hostname,
    WEB_SMOKE_PORT: String(port),
  },
);

try {
  await waitForServer(baseURL);
  const exitCode = await runPlaywright({
    WEB_SMOKE_EXTERNAL_SERVER: "1",
    WEB_SMOKE_HOST: hostname,
    WEB_SMOKE_PORT: String(port),
  });

  process.exitCode = exitCode;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await stopProcessTree(server.pid);
  process.exit(process.exitCode ?? 0);
}

function spawnNodeCli(command, args, env = {}) {
  const child = spawn(process.execPath, [require.resolve(command), ...args], {
    detached: !isWindows,
    env: { ...process.env, ...env },
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  });

  child.on("error", (error) => {
    console.error(error);
  });

  return child;
}

function runPlaywright(env = {}) {
  return new Promise((resolve) => {
    const args = [require.resolve("@playwright/test/cli"), "test", ...playwrightArgs];

    if (process.env.WEB_SMOKE_WORKERS !== undefined && !hasWorkerArg(playwrightArgs)) {
      args.push("--workers", process.env.WEB_SMOKE_WORKERS);
    }

    const child = spawn(process.execPath, args, {
      detached: !isWindows,
      env: { ...process.env, ...env },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let settled = false;
    const timeout = setTimeout(() => {
      console.error(`Playwright did not finish within ${suiteTimeoutMs}ms.`);
      settle(1);
    }, suiteTimeoutMs);

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      process.stderr.write(text);
    });
    child.on("exit", (code) => {
      settle(code ?? 1);
    });
    child.on("error", (error) => {
      console.error(error);
      settle(1);
    });

    function settle(code) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      void stopProcessTree(child.pid).finally(() => resolve(code));
    }
  });
}

function hasWorkerArg(args) {
  return args.some((arg) => arg === "--workers" || arg.startsWith("--workers="));
}

async function waitForServer(url) {
  const deadline = Date.now() + 60_000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);

      if (response.ok || response.status < 500) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await wait(500);
  }

  throw new Error(
    `Next.js server did not become ready at ${url}.${lastError === null ? "" : ` ${lastError}`}`,
  );
}

async function stopProcessTree(pid) {
  if (pid === undefined) {
    return;
  }

  if (isWindows) {
    await runDetached("taskkill", ["/pid", String(pid), "/t", "/f"]);
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      return;
    }
  }
}

function runDetached(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("exit", () => resolve());
    child.on("error", () => resolve());
  });
}
