import os
import re

# 1. src/assets/assets.service.ts
svc_path = 'src/assets/assets.service.ts'
with open(svc_path, 'r') as f:
    c = f.read()
# Put the asset back, but make sure it's valid
c = c.replace("await this.findOne(id);", "const asset = await this.findOne(id);")
with open(svc_path, 'w') as f:
    f.write(c)

# 2. src/attachments/attachments.service.ts
att_path = 'src/attachments/attachments.service.ts'
with open(att_path, 'r') as f:
    c = f.read()
c = c.replace("AttachmentStatus.uploaded", "AttachmentStatus.available")
with open(att_path, 'w') as f:
    f.write(c)

# 3. src/catalog/catalog.service.ts
cat_path = 'src/catalog/catalog.service.ts'
with open(cat_path, 'r') as f:
    c = f.read()
c = re.sub(r'isConsumable: dto.is_consumable \?\? false,[\s]*', '', c)
c = re.sub(r'requiresReturn: dto.requires_return \?\? true,[\s]*', '', c)
with open(cat_path, 'w') as f:
    f.write(c)
