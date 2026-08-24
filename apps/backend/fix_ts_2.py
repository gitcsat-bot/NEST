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
            
        # Fix UserRole casing
        content = content.replace("UserRole.admin", "UserRole.ADMIN")
        content = content.replace("UserRole.stores_manager", "UserRole.STORES_MANAGER")
        content = content.replace("UserRole.contributor", "UserRole.CONTRIBUTOR")
        content = content.replace("UserRole.student", "UserRole.STUDENT")
        content = content.replace("UserRole.viewer", "UserRole.VIEWER")
        
        # Fix InventoryTransactionType
        content = content.replace("InventoryTransactionType.adjust_up", "InventoryTransactionType.adjust")
        content = content.replace("InventoryTransactionType.adjust_down", "InventoryTransactionType.adjust")

        # Fix Request type
        content = content.replace("import { Request } from 'express';", "import { AuthenticatedRequest } from '../auth/guards/session-auth.guard';")
        content = content.replace("@Req() req: Request", "@Req() req: AuthenticatedRequest")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
