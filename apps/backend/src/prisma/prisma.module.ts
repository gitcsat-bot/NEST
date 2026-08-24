import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global so every domain module can inject PrismaService without each
// re-importing this module — standard Nest pattern for a shared DB client.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
