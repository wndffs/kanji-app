import { type INestApplication } from "@nestjs/common";
import { expect, it, vi } from "vitest";
import { configureApiApp } from "../src/main";
import { AppConfigService } from "../src/config/app-config.service";

it("caches only preflight permission while retaining exact configured origins and credentials", () => {
  const origins = ["https://web.example.test"];
  const app = {
    get: vi.fn((token) => (token === AppConfigService ? { webOrigin: origins } : {})),
    useLogger: vi.fn(),
    enableCors: vi.fn(),
    useGlobalFilters: vi.fn(),
    useGlobalPipes: vi.fn(),
  };
  configureApiApp(app as unknown as INestApplication);
  expect(app.enableCors).toHaveBeenCalledWith({
    origin: origins,
    credentials: true,
    exposedHeaders: ["Server-Timing"],
    maxAge: 600,
  });
});
