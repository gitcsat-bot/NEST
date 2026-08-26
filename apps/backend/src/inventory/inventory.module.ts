import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryCsvController } from './inventory.csv.controller';
import { InventoryCsvService } from './inventory.csv.service';

@Module({
  controllers: [InventoryController, InventoryCsvController],
  providers: [InventoryService, InventoryCsvService]
})
export class InventoryModule {}
