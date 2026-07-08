import { spawn } from "node:child_process";
import { clearTimeout, setTimeout } from "node:timers";
import { setTimeout as wait } from "node:timers/promises";

const port = Number(process.env.WEB_SMOKE_PORT ?? 3100);
const hostname = process.env.WEB_SMOKE_HOST ?? "127.0.0.1";
const baseURL = `http://${hostname}:${port}`;
const isWindows = process.platform === "win32";

const server = spawnCommand(
  "npx",
  ["next", "dev", "--port", String(port), "--hostname", hostname],
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
} finally {
  await stopProcessTree(server.pid);
  process.exit(process.exitCode ?? 0);
}

function spawnCommand(command, args, env = {}) {
  const child = spawn(resolveCommand(command), args, {
    detached: !isWindows,
    env: { ...process.env, ...env },
    shell: isWindows,
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
    const args = ["playwright", "test"];

    if (process.env.WEB_SMOKE_WORKERS !== undefined) {
      args.push("--workers", process.env.WEB_SMOKE_WORKERS);
    }

    const child = spawn(resolveCommand("npx"), args, {
      detached: !isWindows,
      env: { ...process.env, ...env },
      shell: isWindows,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let settled = false;
    let output = "";
    let successTimer = null;
    const timeout = setTimeout(() => {
      settle(hasPassingSummary(output) ? 0 : 1);
    }, 90_000);

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
      scheduleSuccessExit();
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
      scheduleSuccessExit();
    });
    child.on("exit", (code) => {
      settle(code ?? (hasPassingSummary(output) ? 0 : 1));
    });
    child.on("error", (error) => {
      console.error(error);
      settle(1);
    });

    function scheduleSuccessExit() {
      if (!hasPassingSummary(output) || successTimer !== null) {
        return;
      }

      successTimer = setTimeout(() => settle(0), 1_000);
    }

    function settle(code) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      if (successTimer !== null) {
        clearTimeout(successTimer);
      }

      void stopProcessTree(child.pid).finally(() => resolve(code));
    }
  });
}

function hasPassingSummary(output) {
  return /\b\d+\s+passed\b/.test(output) && !/\b(failed|timed out)\b/i.test(output);
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

function resolveCommand(command) {
  return isWindows ? `${command}.cmd` : command;
}
