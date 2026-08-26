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
import { QuotationsModule } from './quotations/quotations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
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
    QuotationsModule,
  ],
})
export class AppModule {}
