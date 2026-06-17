import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";

import { PrismaClient } from "@kanji-srs/db";

import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private client: PrismaClient | null = null;

  constructor(@Inject(AppConfigService) config: AppConfigService) {
    this.databaseUrl = config.databaseUrl;
  }

  private readonly databaseUrl: string;

  get db(): PrismaClient {
    this.client ??= new PrismaClient({
      datasources: {
        db: {
          url: this.databaseUrl,
        },
      },
    });

    return this.client;
  }

  get raw(): PrismaClient {
    return this.db;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }
}
