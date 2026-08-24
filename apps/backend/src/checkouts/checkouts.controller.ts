import { Controller, Post, Body, Param, UseGuards, Req, Get } from '@nestjs/common';
import { CheckoutsService } from './checkouts.service';
import { SessionAuthGuard as JwtAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@nest/shared-types';
import { AuthenticatedRequest } from '../auth/guards/session-auth.guard';

@Controller('checkouts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CheckoutsController {
  constructor(private readonly checkoutsService: CheckoutsService) {}

  @Get('active')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER)
  findActive() {
    return this.checkoutsService.findActiveCheckouts();
  }

  @Post(':assetId/checkout')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER, UserRole.CONTRIBUTOR)
  checkout(
    @Param('assetId') assetId: string,
    @Body() body: { heldByUserId: string; expectedReturnAt?: Date },
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user as any;
    return this.checkoutsService.checkoutAsset(assetId, body.heldByUserId, user.id, body.expectedReturnAt);
  }

  @Post(':assetId/checkin')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER, UserRole.CONTRIBUTOR)
  checkin(
    @Param('assetId') assetId: string,
    @Body() body: { condition?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user as any;
    return this.checkoutsService.checkinAsset(assetId, user.id, body.condition);
  }
}
