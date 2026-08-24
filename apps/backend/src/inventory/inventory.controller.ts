import { Controller, Get, Post, Body, Param, Put, UseGuards, Req } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { SessionAuthGuard as JwtAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@nest/shared-types';
import { AuthenticatedRequest } from '../auth/guards/session-auth.guard';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll() {
    return this.inventoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Post(':id/receive')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER, UserRole.CONTRIBUTOR)
  receive(
    @Param('id') id: string,
    @Body() body: { quantity: number; notes?: string; projectId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user as any;
    return this.inventoryService.receiveStock(id, body.quantity, user.id, body.notes, body.projectId);
  }

  @Post(':id/consume')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER, UserRole.CONTRIBUTOR, UserRole.STUDENT)
  consume(
    @Param('id') id: string,
    @Body() body: { quantity: number; notes?: string; projectId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user as any;
    return this.inventoryService.consumeStock(id, body.quantity, user.id, body.notes, body.projectId);
  }

  @Put(':id/adjust')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER)
  adjust(
    @Param('id') id: string,
    @Body() body: { quantity: number; notes?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user as any;
    return this.inventoryService.adjustStock(id, body.quantity, user.id, body.notes);
  }

  @Put(':id/reconcile')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER)
  reconcile(
    @Param('id') id: string,
    @Body() body: { actualQuantity: number; notes?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user as any;
    return this.inventoryService.reconcile(id, body.actualQuantity, user.id, body.notes);
  }
}
