const fs = require('fs');
['apps/backend/src/catalog/deletion-requests.service.spec.ts', 'apps/backend/src/materials/materials.service.spec.ts', 'apps/backend/src/mail/mail-worker.service.spec.ts', 'apps/backend/src/reports/reports.service.spec.ts'].forEach(f => {
  if (fs.existsSync(f)) {
    let text = fs.readFileSync(f, 'utf8');
    text = text.replace(/import \{ ApiExceptions \} from '\.\.\/common\/dto\/api-exception';\n?/g, '');
    text = text.replace(/import \{ AssetStatus, InventoryRequestStatus \} from '@nest\/shared-types';\n?/g, '');
    fs.writeFileSync(f, text);
  }
});
