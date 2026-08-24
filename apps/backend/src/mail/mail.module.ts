import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailService } from './mail.service';
import { MailWorkerService } from './mail-worker.service';

@Module({
  imports: [PrismaModule],
  providers: [MailService, MailWorkerService],
  exports: [MailService],
})
export class MailModule {}
