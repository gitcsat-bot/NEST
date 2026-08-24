import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MailService', () => {
  let service: MailService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = { $executeRaw: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get<MailService>(MailService);
  });

  it('inserts a pending row into the outbox with the given fields', async () => {
    await service.enqueue('someone@example.com', 'Subject line', 'Body text');

    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
    const insertSql = prismaMock.$executeRaw.mock.calls[0][0];
    expect(insertSql.sql).toContain('INSERT INTO email_outbox');
    expect(insertSql.values).toEqual(['someone@example.com', 'Subject line', 'Body text']);
  });
});
