import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { LocationsModule } from './locations/locations.module';
import { CatalogModule } from './catalog/catalog.module';
import { MaterialsModule } from './materials/materials.module';
import { ReportsModule } from './reports/reports.module';
import { AssetsModule } from './assets/assets.module';
import { InventoryModule } from './inventory/inventory.module';
import { CheckoutsModule } from './checkouts/checkouts.module';
import { TransfersModule } from './transfers/transfers.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { SearchModule } from './search/search.module';
import { ReservationsModule } from './reservations/reservations.module';

// Module map — mirrors the Repository Structure's backend module list.
// Each module owns its own persistence and exposes only a service-layer
// interface to others (ADR-001). Domain modules beyond auth/users/health
// (locations, assets, inventory, ...) are added starting with Phase 1's
// Locations workstream (Implementation Plan §4.1) — see the note at the
// bottom of prisma/schema.prisma for why they aren't scaffolded yet.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    // API Contract §11 — rate-limit tiers. The "general" tier is registered
    // globally here; the "strict" tier for auth endpoints is applied via a
    // per-route override in AuthModule (see auth.controller.ts).
    ThrottlerModule.forRoot([
      { name: 'general', ttl: 60_000, limit: 300 },
    ]),
    PrismaModule,
    AuditModule,
    AuthModule,
    DashboardModule,
    UsersModule,
    HealthModule,
    LocationsModule,
    CatalogModule,
    MaterialsModule,
    ReportsModule,
    AssetsModule,
    InventoryModule,
    CheckoutsModule,
    TransfersModule,
    AttachmentsModule,
    SearchModule,
    ReservationsModule,
  ],
})
export class AppModule {}
