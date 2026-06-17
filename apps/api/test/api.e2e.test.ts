import { type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/main";

describe("API application", () => {
  it("starts and serves /health", async () => {
    let app: INestApplication | null = null;

    try {
      app = await NestFactory.create(AppModule, {
        logger: false,
      });
      configureApiApp(app);
      await app.listen(0);

      const server = app.getHttpServer() as { address(): { port: number } | string | null };
      const address = server.address();

      if (address === null || typeof address === "string") {
        throw new Error("Unable to resolve test server port.");
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/health`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        service: "kanji-srs-api",
        status: "ok",
      });
    } finally {
      await app?.close();
    }
  });
});
