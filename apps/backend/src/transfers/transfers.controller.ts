import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { SessionAuthGuard as JwtAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@nest/shared-types';
import { AuthenticatedRequest } from '../auth/guards/session-auth.guard';

@Controller('transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post('asset/:assetId')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER, UserRole.CONTRIBUTOR)
  transferAsset(
    @Param('assetId') assetId: string,
    @Body() body: { toLocationId: string; reason?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user as any;
    return this.transfersService.transferAssetInstance(assetId, body.toLocationId, user.id, body.reason);
  }

  @Post('inventory/:inventoryId')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER, UserRole.CONTRIBUTOR)
  transferInventory(
    @Param('inventoryId') inventoryId: string,
    @Body() body: { toLocationId: string; quantity: number; reason?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user as any;
    return this.transfersService.transferInventory(inventoryId, body.toLocationId, body.quantity, user.id, body.reason);
  }
}
