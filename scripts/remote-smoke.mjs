const webUrl = normalizeBaseUrl(process.env.STAGING_WEB_URL);
const apiUrl = normalizeBaseUrl(process.env.STAGING_API_URL);

if (webUrl === null || apiUrl === null) {
  throw new Error("Set STAGING_WEB_URL and STAGING_API_URL before running remote smoke.");
}

const credentials = resolveSmokeCredentials();
const startedAt = new Date();

await checkHealth("web", `${webUrl}/api/health`);
await checkHealth("api", `${apiUrl}/health`);
await runApiSmoke(credentials);

console.log(
  `Remote smoke passed for ${webUrl} and ${apiUrl} in ${Date.now() - startedAt.getTime()}ms.`,
);

async function runApiSmoke(credentials) {
  const session = await registerOrLogin(credentials);
  const dashboard = await apiJson("/dashboard", {
    token: session.accessToken,
  });

  if (dashboard.currentCourse === null) {
    throw new Error(
      "Registered staging user has no active starter course. Run db:seed and verify auto-enrollment.",
    );
  }

  if (dashboard.counts.availableLessons < 1) {
    throw new Error(
      `Expected at least one available starter lesson, got ${dashboard.counts.availableLessons}.`,
    );
  }

  const lessonQueue = await apiJson("/lessons/queue", {
    token: session.accessToken,
  });

  if (!Array.isArray(lessonQueue.items) || lessonQueue.items.length < 1) {
    throw new Error("Expected non-empty starter lesson queue for staging smoke user.");
  }

  console.log(
    `API smoke user ${session.user.email} is enrolled in ${dashboard.currentCourse.title} with ${lessonQueue.items.length} lesson item(s).`,
  );
}

async function registerOrLogin(credentials) {
  const registerResponse = await fetch(`${apiUrl}/auth/register`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
      displayName: "Remote smoke",
      settings: {
        translationDisplayMode: "ru-en",
        timezone: "Europe/Moscow",
      },
    }),
  });

  if (registerResponse.ok) {
    return await registerResponse.json();
  }

  if (registerResponse.status !== 409 || credentials.isGenerated) {
    throw new Error(
      `Registration failed with ${registerResponse.status}: ${await registerResponse.text()}`,
    );
  }

  return await apiJson("/auth/login", {
    method: "POST",
    body: {
      email: credentials.email,
      password: credentials.password,
    },
  });
}

async function checkHealth(label, url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${label} health check failed with ${response.status}: ${await response.text()}`);
  }

  console.log(`${label} health ok: ${url}`);
}

async function apiJson(path, options = {}) {
  const headers = jsonHeaders();

  if (options.token !== undefined) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

function jsonHeaders() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function resolveSmokeCredentials() {
  const configuredEmail = process.env.STAGING_SMOKE_EMAIL?.trim();
  const configuredPassword = process.env.STAGING_SMOKE_PASSWORD?.trim();

  if (configuredEmail !== undefined && configuredEmail !== "") {
    if (configuredPassword === undefined || configuredPassword === "") {
      throw new Error("Set STAGING_SMOKE_PASSWORD when STAGING_SMOKE_EMAIL is set.");
    }

    return {
      email: configuredEmail,
      password: configuredPassword,
      isGenerated: false,
    };
  }

  return {
    email: `codex-smoke-${Date.now()}@example.test`,
    password: `smoke-${Date.now()}-password`,
    isGenerated: true,
  };
}

function normalizeBaseUrl(value) {
  if (value === undefined || value.trim() === "") {
    return null;
  }

  return value.trim().replace(/\/+$/, "");
}
