import os
import re

src_dir = 'src'

# Modules to fix
modules = ['assets', 'inventory', 'checkouts', 'transfers', 'attachments', 'search', 'dashboard', 'reservations']

for mod in modules:
    mod_dir = os.path.join(src_dir, mod)
    if not os.path.exists(mod_dir):
        continue
    
    for filename in os.listdir(mod_dir):
        if not filename.endswith('.ts'):
            continue
            
        filepath = os.path.join(mod_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Fix UserRole
        content = re.sub(r"import \{.*?UserRole.*?\} from '@prisma/client';", 
                         lambda m: m.group(0).replace('UserRole', '').replace(',  ', ' ').replace(', }', '}').replace('{  }', '{}') + "\nimport { UserRole } from '@nest/shared-types';", 
                         content)
        content = re.sub(r"import \{ UserRole \} from '@prisma/client';", "import { UserRole } from '@nest/shared-types';", content)
        
        # Fix other Prisma client imports
        content = content.replace("'@prisma/client'", "'../../generated/prisma'")
        content = content.replace("import {} from '../../generated/prisma';\n", "")
        
        # Fix JwtAuthGuard
        content = content.replace("import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';", "import { SessionAuthGuard as JwtAuthGuard } from '../auth/guards/session-auth.guard';")
        
        # Fix req.user.userId -> req.user.id
        content = content.replace("user.userId", "user.id")
        
        # Fix specific properties
        content = content.replace("heldByUser: true", "heldBy: true")
        content = content.replace("checkedOutByUser: true", "checkedOutBy: true")

        # In inventory.service.ts, 'UserRole' might still be imported from @prisma/client directly
        content = content.replace("import { InventoryTransactionType, UserRole } from '../../generated/prisma';", "import { InventoryTransactionType } from '../../generated/prisma';\nimport { UserRole } from '@nest/shared-types';")

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
