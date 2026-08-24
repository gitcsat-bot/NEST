import { Test, TestingModule } from '@nestjs/testing';
import { MailWorkerService } from './mail-worker.service';
import { PrismaService } from '../prisma/prisma.service';

// No SMTP_HOST in the test environment, so every test exercises the
// "no transporter configured" branch of deliver() unless the recipient
// is a console test account — both paths just console.log and mark the
// row sent, which is exactly what we want to assert here without
// actually sending mail or needing a real outbox table (Prisma is
// mocked at the $queryRaw/$executeRaw boundary, same pattern as
// materials.service.spec.ts — see the note at the top of
// materials.service.ts for why).
//
// Claiming and delivering are NOT wrapped in a $transaction (see the
// doc comment at the top of mail-worker.service.ts for why — a real
// production bug where a slow SMTP send outlived Prisma's 5s
// interactive-transaction timeout, causing double-sends). The first
// test below asserts $transaction is never called, specifically to
// catch a regression back to that pattern.
describe('MailWorkerService', () => {
  let service: MailWorkerService;
  let prismaMock: any;
  let consoleSpy: jest.SpyInstance;

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailWorkerService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<MailWorkerService>(MailWorkerService);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    service.onModuleDestroy();
  });

  it('marks a message sent after successful delivery, without wrapping delivery in a transaction', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: 'msg-1' }]) // pollOnce: pending ids
      .mockResolvedValueOnce([
        { id: 'msg-1', to_email: 'someone@example.com', subject: 'Hi', body_text: 'Body', attempts: 0 },
      ]); // processOne: claim row (plain SELECT, no FOR UPDATE / no transaction)

    await (service as any).pollOnce();

    // The regression this guards against: claiming + delivering + the
    // status update must NOT happen inside $transaction. A slow SMTP
    // call inside a Prisma interactive transaction can outlive its 5s
    // default timeout, causing the DB write to fail *after* the email
    // has already been sent — resulting in duplicate sends on retry.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();

    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
    const updateSql = prismaMock.$executeRaw.mock.calls[0][0];
    expect(updateSql.sql).toContain("SET status = 'sent'");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('NO SMTP CONFIGURED'),
    );
  });

  it('routes designated test accounts through the console path regardless of SMTP config', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: 'msg-2' }])
      .mockResolvedValueOnce([
        { id: 'msg-2', to_email: 'test@nest.local', subject: '2FA code', body_text: '123456', attempts: 0 },
      ]);

    await (service as any).pollOnce();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('TEST ACCOUNT'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test@nest.local'));
  });

  it('skips a row that is no longer pending by the time it is claimed', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: 'msg-3' }])
      .mockResolvedValueOnce([]); // WHERE status = 'pending' matched nothing — already handled

    await (service as any).pollOnce();

    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
  });

  it('increments attempts and keeps status pending on failure below MAX_ATTEMPTS', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: 'msg-4' }])
      .mockResolvedValueOnce([
        { id: 'msg-4', to_email: 'someone@example.com', subject: 'Hi', body_text: 'Body', attempts: 1 },
      ]);
    // Force the delivery path to throw by making console.log itself throw
    // once — simplest way to exercise the catch branch without wiring a
    // real transporter.
    consoleSpy.mockImplementationOnce(() => {
      throw new Error('simulated delivery failure');
    });

    await (service as any).pollOnce();

    const updateSql = prismaMock.$executeRaw.mock.calls[0][0];
    expect(updateSql.sql).toContain('attempts =');
    expect(updateSql.values).toContain(2); // attempts incremented from 1 -> 2
    expect(updateSql.values).toContain('pending'); // still below MAX_ATTEMPTS (3)
  });

  it('marks the message failed once attempts reach MAX_ATTEMPTS', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: 'msg-5' }])
      .mockResolvedValueOnce([
        { id: 'msg-5', to_email: 'someone@example.com', subject: 'Hi', body_text: 'Body', attempts: 2 },
      ]);
    consoleSpy.mockImplementationOnce(() => {
      throw new Error('simulated delivery failure');
    });

    await (service as any).pollOnce();

    const updateSql = prismaMock.$executeRaw.mock.calls[0][0];
    expect(updateSql.values).toContain(3);
    expect(updateSql.values).toContain('failed');
  });
});
