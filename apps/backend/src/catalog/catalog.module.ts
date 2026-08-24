import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CatalogController } from './catalog.controller';
import { CatalogDeletionRequestsController } from './deletion-requests.controller';
import { CatalogService } from './catalog.service';
import { CatalogDeletionRequestsService } from './deletion-requests.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CatalogController, CatalogDeletionRequestsController],
  providers: [CatalogService, CatalogDeletionRequestsService],
  exports: [CatalogService, CatalogDeletionRequestsService],
})
export class CatalogModule {}
