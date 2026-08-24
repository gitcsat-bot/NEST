import { Controller, Post, Body, Param, UseGuards, Req, Get, Put } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { SessionAuthGuard as JwtAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PolymorphicTargetType, ReservationStatus } from '../../generated/prisma';
import { UserRole } from '@nest/shared-types';
import { AuthenticatedRequest } from '../auth/guards/session-auth.guard';

@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER, UserRole.CONTRIBUTOR, UserRole.STUDENT)
  create(
    @Body() body: { targetType: PolymorphicTargetType; targetId: string; reservedForUserId?: string; quantity?: number; expiresAt?: Date },
    @Req() req: AuthenticatedRequest
  ) {
    const user = req.user as any;
    const reservedFor = body.reservedForUserId || user.id;
    return this.reservationsService.createReservation(body.targetType, body.targetId, reservedFor, user.id, body.quantity, body.expiresAt);
  }

  @Get('my')
  findMyActive(@Req() req: AuthenticatedRequest) {
    const user = req.user as any;
    return this.reservationsService.findActiveReservationsForUser(user.id);
  }

  @Put(':id/status')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: ReservationStatus }
  ) {
    return this.reservationsService.updateReservationStatus(id, body.status);
  }
}
