import { Inject, Injectable } from "@nestjs/common";

import { type Prisma } from "@kanji-srs/db";

import { PrismaService } from "../database/prisma.service";

const CACHE_TTL_MS = 7_500;
const RESPONSE_DEADLINE_MS = 3_000;
const TRANSACTION_TIMEOUT_MS = 2_000;
const TRANSACTION_MAX_WAIT_MS = 500;

export type ReadinessResponse = {
  readonly service: "kanji-srs-api";
  readonly status: "ready" | "unavailable";
  readonly database: "available" | "unavailable";
};

@Injectable()
export class ReadinessService {
  private cached: { readonly response: ReadinessResponse; readonly expiresAt: number } | null =
    null;
  private inFlight: Promise<ReadinessResponse> | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getReadiness(): Promise<ReadinessResponse> {
    if (this.cached !== null && Date.now() < this.cached.expiresAt) {
      return Promise.resolve(this.cached.response);
    }

    if (this.inFlight !== null) {
      return this.inFlight;
    }

    this.inFlight = new Promise<ReadinessResponse>((resolve) => {
      let answered = false;
      const answer = (available: boolean): void => {
        if (answered) return;
        answered = true;
        const response: ReadinessResponse = {
          service: "kanji-srs-api",
          status: available ? "ready" : "unavailable",
          database: available ? "available" : "unavailable",
        };
        this.cached = { response, expiresAt: Date.now() + CACHE_TTL_MS };
        resolve(response);
      };
      const deadline = setTimeout(() => answer(false), RESPONSE_DEADLINE_MS);
      const complete = (available: boolean): void => {
        clearTimeout(deadline);
        if (answered && available) {
          this.cached = {
            response: { service: "kanji-srs-api", status: "ready", database: "available" },
            expiresAt: Date.now() + CACHE_TTL_MS,
          };
        }
        answer(available);
        // A response timeout does not release this slot while driver work is still pending.
        this.inFlight = null;
      };

      void this.probeDatabase().then(
        () => complete(true),
        () => complete(false),
      );
    });

    return this.inFlight;
  }

  private async probeDatabase(): Promise<void> {
    let queries: Promise<void> | undefined;
    try {
      await this.prisma.db.$transaction(
        (tx) => {
          queries = this.selectOne(tx);
          void queries.catch(() => undefined);
          return queries;
        },
        { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
      );
    } finally {
      // Interactive transaction timeouts may reject before their callback has settled.
      await queries?.catch(() => undefined);
    }
  }

  private async selectOne(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`SET LOCAL statement_timeout = '1500ms'`;
    await tx.$queryRaw`SELECT 1`;
  }
}
