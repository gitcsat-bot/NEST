import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { MaterialsController, InventoryRequestsController } from './materials.controller';
import { MaterialsService } from './materials.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [MaterialsController, InventoryRequestsController],
  providers: [MaterialsService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
