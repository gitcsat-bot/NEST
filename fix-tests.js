const fs = require('fs');
const path = require('path');

const baseDir = 'apps/backend/src';
const specsToUpdate = [
  'attachments/attachments.controller.spec.ts',
  'transfers/transfers.controller.spec.ts',
  'inventory/inventory.controller.spec.ts',
  'checkouts/checkouts.controller.spec.ts',
  'assets/assets.controller.spec.ts',
];

const serviceSpecsToUpdate = [
  'attachments/attachments.service.spec.ts',
  'transfers/transfers.service.spec.ts',
  'inventory/inventory.service.spec.ts',
  'checkouts/checkouts.service.spec.ts',
  'assets/assets.service.spec.ts',
];

specsToUpdate.forEach(spec => {
  const fullPath = path.join(baseDir, spec);
  const name = spec.split('/')[0];
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  const content = `import { Test, TestingModule } from '@nestjs/testing';
import { ${capitalized}Controller } from './${name}.controller';
import { ${capitalized}Service } from './${name}.service';
import { PrismaService } from '../prisma/prisma.service';

describe('${capitalized}Controller', () => {
  let controller: ${capitalized}Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [${capitalized}Controller],
      providers: [
        { provide: ${capitalized}Service, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<${capitalized}Controller>(${capitalized}Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
`;
  if (fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${fullPath}`);
  }
});

serviceSpecsToUpdate.forEach(spec => {
  const fullPath = path.join(baseDir, spec);
  const name = spec.split('/')[0];
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  const content = `import { Test, TestingModule } from '@nestjs/testing';
import { ${capitalized}Service } from './${name}.service';
import { PrismaService } from '../prisma/prisma.service';

describe('${capitalized}Service', () => {
  let service: ${capitalized}Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ${capitalized}Service,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<${capitalized}Service>(${capitalized}Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
`;
  if (fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${fullPath}`);
  }
});
