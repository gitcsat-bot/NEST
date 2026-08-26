const Papa = require('papaparse');
const csv = 'SKU [Required],Name [Required],Manufacturer [Optional],Model No [Optional],Description [Optional],Location [Required],Quantity [Required]\nPART-999,Test Item,Test Corp,10K-RES,Test desc,Main Warehouse,50';
const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
console.log('Errors:', parsed.errors);
let processedCount = 0;
for (const rawRow of parsed.data) {
  const row = {};
  for (const key of Object.keys(rawRow)) {
    const normalizedKey = key.toLowerCase().replace(/\[.*?\]/g, '').trim().replace(/\s+/g, '_');
    row[normalizedKey] = rawRow[key];
  }
  const sku = row.sku || row.part_number;
  const name = row.name;
  const locationName = row.location;
  const quantityStr = row.quantity || row.number_of_pieces;
  console.log('Row extracted:', { sku, name, locationName, quantityStr });
  if (!sku || !name || !locationName || !quantityStr) {
    console.log('Skipping due to missing fields');
    continue;
  }
  processedCount++;
}
console.log('Processed:', processedCount);
