const fs = require('fs');

const reportsPath = 'apps/backend/src/reports/reports.service.spec.ts';
let reportsContent = fs.readFileSync(reportsPath, 'utf8');

reportsContent = reportsContent.replace(
  `$queryRaw: jest.fn().mockResolvedValue([]),`,
  `$queryRaw: jest.fn().mockResolvedValue([]),
      inventoryItem: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      reservation: { count: jest.fn().mockResolvedValue(0) },`
);

fs.writeFileSync(reportsPath, reportsContent);

const catalogPath = 'apps/backend/src/catalog/deletion-requests.service.spec.ts';
let catalogContent = fs.readFileSync(catalogPath, 'utf8');

catalogContent = catalogContent.replace(
  `prismaMock.$queryRaw.mockResolvedValueOnce([requestRow({ status: InventoryRequestStatus.REJECTED })]);`,
  `prismaMock.catalogDeletionRequest.findUnique.mockResolvedValueOnce(requestRow({ status: InventoryRequestStatus.REJECTED }));`
);
catalogContent = catalogContent.replace(
  `prismaMock.$queryRaw.mockResolvedValueOnce([requestRow({ status: InventoryRequestStatus.PENDING })]);`,
  `prismaMock.catalogDeletionRequest.findUnique.mockResolvedValueOnce(requestRow({ status: InventoryRequestStatus.PENDING }));`
);
catalogContent = catalogContent.replace(
  `prismaMock.$queryRaw
        .mockResolvedValueOnce([requestRow({ status: InventoryRequestStatus.PENDING })]) // pre-check
        .mockResolvedValueOnce([requestRow({ status: InventoryRequestStatus.REJECTED })]); // findById() re-select`,
  `prismaMock.catalogDeletionRequest.findUnique.mockResolvedValueOnce(requestRow({ status: InventoryRequestStatus.PENDING }));
      prismaMock.catalogDeletionRequest.update.mockResolvedValueOnce(requestRow({ status: InventoryRequestStatus.REJECTED }));`
);
catalogContent = catalogContent.replace(
  `prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // no existing pending
        .mockResolvedValueOnce([{ id: 'req-1' }]) // INSERT ... RETURNING id
        .mockResolvedValueOnce([requestRow()]); // findById() re-select`,
  `prismaMock.catalogDeletionRequest.findFirst.mockResolvedValueOnce(null);
      prismaMock.catalogDeletionRequest.create.mockResolvedValueOnce(requestRow());`
);
catalogContent = catalogContent.replace(
  `prismaMock.$queryRaw.mockResolvedValueOnce([requestRow()]);`,
  `prismaMock.catalogDeletionRequest.findFirst.mockResolvedValueOnce(requestRow());`
);

fs.writeFileSync(catalogPath, catalogContent);

console.log('Fixed reports and catalog tests');
