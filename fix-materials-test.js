const fs = require('fs');

const path = 'apps/backend/src/materials/materials.service.spec.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `prismaMock.$queryRaw
        .mockResolvedValueOnce([materialRow()]) // items query
        .mockResolvedValueOnce([{ count: 1n }]); // count query

      await service.findAll({ assetDefinitionId: 'ad-1', page: 1, pageSize: 25 });

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
      const itemsQuery = prismaMock.$queryRaw.mock.calls[0][0];
      const countQuery = prismaMock.$queryRaw.mock.calls[1][0];
      // Prisma.sql produces a tagged-template Sql object — check its
      // rendered \`.sql\` text and bound \`.values\` rather than string-
      // concatenating, since that's what actually gets sent to Postgres.
      expect(itemsQuery.sql).toContain('m.asset_definition_id = ');
      expect(itemsQuery.values).toContain('ad-1');
      expect(countQuery.sql).toContain('m.asset_definition_id = ');
      expect(countQuery.values).toContain('ad-1');`,
  `prismaMock.inventoryItem.findMany.mockResolvedValueOnce([materialRow()]);
      prismaMock.inventoryItem.count.mockResolvedValueOnce(1);

      await service.findAll({ assetDefinitionId: 'ad-1', page: 1, pageSize: 25 });

      expect(prismaMock.inventoryItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ assetDefinitionId: 'ad-1' }) }));`
);

content = content.replace(
  `prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }]);

      await service.findAll({ page: 1, pageSize: 25 });

      const itemsQuery = prismaMock.$queryRaw.mock.calls[0][0];
      expect(itemsQuery.sql).not.toContain('WHERE');`,
  `prismaMock.inventoryItem.findMany.mockResolvedValueOnce([]);
      prismaMock.inventoryItem.count.mockResolvedValueOnce(0);

      await service.findAll({ page: 1, pageSize: 25 });

      expect(prismaMock.inventoryItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));`
);

content = content.replace(
  `prismaMock.$queryRaw
        .mockResolvedValueOnce([{ id: 'mat-1' }]) // INSERT ... RETURNING id
        .mockResolvedValueOnce([materialRow()]); // findById() re-select`,
  `prismaMock.inventoryItem.create.mockResolvedValueOnce({ id: 'mat-1', quantityOnHand: 3, assetDefinition: {}, location: {} });`
);

content = content.replace(
  `prismaMock.$queryRaw.mockResolvedValueOnce([materialRow({ status: AssetStatus.RETIRED })]);`,
  `prismaMock.inventoryItem.findUnique.mockResolvedValueOnce(materialRow({ status: AssetStatus.RETIRED }));`
);

content = content.replace(
  `prismaMock.$queryRaw
        .mockResolvedValueOnce([materialRow({ status: AssetStatus.AVAILABLE })])
        .mockResolvedValueOnce([{ id: 'mat-1' }]); // UPDATE ... RETURNING id`,
  `prismaMock.inventoryItem.findUnique.mockResolvedValueOnce(materialRow({ status: AssetStatus.AVAILABLE }));
      prismaMock.inventoryItem.update.mockResolvedValueOnce(materialRow({ id: 'mat-1' }));`
);

content = content.replace(
  `prismaMock.$queryRaw.mockResolvedValueOnce([]);`,
  `prismaMock.inventoryItem.findUnique.mockResolvedValueOnce(null);`
);

content = content.replace(
  `prismaMock.$queryRaw.mockResolvedValueOnce([materialRow()]);`,
  `prismaMock.inventoryItem.findUnique.mockResolvedValueOnce(materialRow());`
);

content = content.replace(
  `prismaMock.$queryRaw
        .mockResolvedValueOnce([{ id: 'req-1' }]) // INSERT ... RETURNING id
        .mockResolvedValueOnce([inventoryRequestRow()]); // findById() re-select`,
  `prismaMock.reservation.create.mockResolvedValueOnce(inventoryRequestRow());`
);

content = content.replace(
  `prismaMock.$queryRaw.mockResolvedValueOnce([inventoryRequestRow({ status: InventoryRequestStatus.APPROVED })]);`,
  `prismaMock.reservation.findUnique.mockResolvedValueOnce(inventoryRequestRow({ status: InventoryRequestStatus.APPROVED }));`
);

content = content.replace(
  `prismaMock.$queryRaw
        .mockResolvedValueOnce([inventoryRequestRow({ status: InventoryRequestStatus.PENDING })]) // find request
        .mockResolvedValueOnce([materialRow({ id: 'mat-1' })]) // verify material
        .mockResolvedValueOnce([{ id: 'mat-1' }]) // update material
        .mockResolvedValueOnce([{ id: 'req-1' }]); // update request`,
  `prismaMock.reservation.findUnique.mockResolvedValueOnce(inventoryRequestRow({ status: InventoryRequestStatus.PENDING }));
      prismaMock.inventoryItem.findUnique.mockResolvedValueOnce(materialRow({ id: 'mat-1' }));
      prismaMock.inventoryItem.update.mockResolvedValueOnce(materialRow({ id: 'mat-1' }));
      prismaMock.reservation.update.mockResolvedValueOnce(inventoryRequestRow({ id: 'req-1' }));`
);

content = content.replace(
  `prismaMock.$queryRaw
        .mockResolvedValueOnce([inventoryRequestRow({ status: InventoryRequestStatus.PENDING })]) // find request
        .mockResolvedValueOnce([{ id: 'req-1' }]); // update request`,
  `prismaMock.reservation.findUnique.mockResolvedValueOnce(inventoryRequestRow({ status: InventoryRequestStatus.PENDING }));
      prismaMock.reservation.update.mockResolvedValueOnce(inventoryRequestRow({ id: 'req-1' }));`
);


fs.writeFileSync(path, content);
console.log('Fixed materials.service.spec.ts');
