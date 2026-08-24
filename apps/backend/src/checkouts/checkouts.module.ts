import { Module } from '@nestjs/common';
import { CheckoutsController } from './checkouts.controller';
import { CheckoutsService } from './checkouts.service';

@Module({
  controllers: [CheckoutsController],
  providers: [CheckoutsService]
})
export class CheckoutsModule {}
