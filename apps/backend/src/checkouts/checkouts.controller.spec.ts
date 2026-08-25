import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutsController } from './checkouts.controller';
import { CheckoutsService } from './checkouts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CheckoutsController', () => {
  let controller: CheckoutsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckoutsController],
      providers: [
        { provide: CheckoutsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<CheckoutsController>(CheckoutsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
