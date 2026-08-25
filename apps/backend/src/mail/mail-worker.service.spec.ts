import { Test, TestingModule } from '@nestjs/testing';
import { MailWorkerService } from './mail-worker.service';
import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MailWorkerService', () => {
  let service: MailWorkerService;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailWorkerService,
        { provide: PrismaService, useValue: {} },
        { provide: MailService, useValue: {} },
      ],
    }).compile();

    service = module.get<MailWorkerService>(MailWorkerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
