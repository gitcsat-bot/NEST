import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';

// Database Design §7 / two-role split (ADR-004): the Prisma CLI (`migrate
// dev`, `migrate deploy`, `db seed`) only ever reads `DATABASE_URL` from
// schema.prisma's datasource block — that's Prisma's own convention, not
// something we can rename. So `DATABASE_URL` is deliberately the
// nest_migrator connection string; it's what CLI commands use.
//
// This service is the RUNNING APPLICATION, which must never connect as
// nest_migrator (that would defeat the entire point of the least-privilege
// role split). It explicitly overrides the connection with
// `APP_DATABASE_URL` — the nest_app connection string — via the
// `datasourceUrl` constructor option, so the two are guaranteed to never
// be conflated by an env var name collision.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const appDatabaseUrl = process.env.APP_DATABASE_URL;
    if (!appDatabaseUrl) {
      throw new Error(
        'APP_DATABASE_URL is not set. The running application must connect as the ' +
          'least-privilege nest_app role, not the nest_migrator role used by DATABASE_URL ' +
          '(Database Design §7). See apps/backend/.env.example.',
      );
    }
    super({ datasourceUrl: appDatabaseUrl });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
