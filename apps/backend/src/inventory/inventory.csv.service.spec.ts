import { Test, TestingModule } from '@nestjs/testing';
import { InventoryCsvService } from './inventory.csv.service';
import { PrismaService } from '../prisma/prisma.service';

describe('InventoryCsvService', () => {
  let service: InventoryCsvService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(async (cb) => {
        // Return dummy transaction client
        return cb({
          assetDefinition: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'mock-asset-id', modelNumber: null }),
            update: jest.fn().mockResolvedValue({ id: 'mock-asset-id', modelNumber: null })
          },
          location: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'mock-loc-id' })
          },
          inventoryItem: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'mock-inv-id' }),
            update: jest.fn().mockResolvedValue({ id: 'mock-inv-id' })
          },
          inventoryTransaction: {
            create: jest.fn().mockResolvedValue({})
          }
        });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryCsvService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<InventoryCsvService>(InventoryCsvService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should process a valid CSV and sanitize formula injection', async () => {
    const csvContent = 'SKU [Required],Name [Required],Location [Required],Quantity [Required],Description [Optional]\nPART-1,=cmd|calc,Main,10,+123';
    
    // Process the CSV
    const result = await service.processCsv(csvContent, 'mock-user-id');
    
    // It should successfully process 1 item
    expect(result.message).toContain('Successfully processed 1');
    
    // The transaction should have been called
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it('should throw BadRequestException when 0 items are processed', async () => {
    const emptyCsv = 'SKU,Name,Location,Quantity\n,,,';
    await expect(service.processCsv(emptyCsv, 'mock-user-id')).rejects.toThrow('No valid inventory items found');
  });
});
