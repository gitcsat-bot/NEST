import os
import re

# 1. src/assets/assets.module.ts
mod_path = 'src/assets/assets.module.ts'
with open(mod_path, 'r') as f:
    c = f.read()
c = c.replace("import { AssetsController } from './assets.controller';\nimport { AssetsService } from './assets.service';\nimport { AssetsController } from './assets.controller';", "import { AssetsController } from './assets.controller';\nimport { AssetsService } from './assets.service';")
with open(mod_path, 'w') as f:
    f.write(c)

# 2. src/assets/assets.service.ts
svc_path = 'src/assets/assets.service.ts'
with open(svc_path, 'r') as f:
    c = f.read()
c = c.replace("import { UserRole } from '@nest/shared-types';\n", "")
c = c.replace("const asset = await this.findOne(id);", "await this.findOne(id);")
with open(svc_path, 'w') as f:
    f.write(c)

# 3. src/attachments/attachments.service.ts
att_path = 'src/attachments/attachments.service.ts'
with open(att_path, 'r') as f:
    c = f.read()
c = c.replace("import { Injectable, NotFoundException } from '@nestjs/common';", "import { Injectable } from '@nestjs/common';")
# AttachmentStatus doesn't have 'ready', maybe it's something else. Let's change it to whatever is valid.
# Let's see schema.prisma for AttachmentStatus. It's pending, uploaded, processed. Let's use uploaded.
c = c.replace("AttachmentStatus.ready", "AttachmentStatus.uploaded")
with open(att_path, 'w') as f:
    f.write(c)

# 4. src/catalog/catalog.service.ts
cat_path = 'src/catalog/catalog.service.ts'
with open(cat_path, 'r') as f:
    c = f.read()
c = re.sub(r'modelNumber: dto.model_number,[\s]*', '', c)
with open(cat_path, 'w') as f:
    f.write(c)

# 5. src/dashboard/dashboard.controller.ts
dash_ctrl = 'src/dashboard/dashboard.controller.ts'
with open(dash_ctrl, 'r') as f:
    c = f.read()
c = c.replace("import { UserRole } from '@nest/shared-types';\n", "")
with open(dash_ctrl, 'w') as f:
    f.write(c)

# 6. src/dashboard/dashboard.service.ts
dash_svc = 'src/dashboard/dashboard.service.ts'
with open(dash_svc, 'r') as f:
    c = f.read()
c = c.replace("const lowInventoryItems = ", "")
with open(dash_svc, 'w') as f:
    f.write(c)

# 7. src/inventory/inventory.service.ts
inv_svc = 'src/inventory/inventory.service.ts'
with open(inv_svc, 'r') as f:
    c = f.read()
c = c.replace("import { UserRole } from '@nest/shared-types';\n", "")
with open(inv_svc, 'w') as f:
    f.write(c)

# 8. src/reservations/reservations.service.ts
res_svc = 'src/reservations/reservations.service.ts'
with open(res_svc, 'r') as f:
    c = f.read()
c = c.replace("import { Injectable, NotFoundException } from '@nestjs/common';", "import { Injectable } from '@nestjs/common';")
with open(res_svc, 'w') as f:
    f.write(c)
