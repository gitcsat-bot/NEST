import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { SessionAuthGuard as JwtAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AssetStatus, RelationshipType } from '../../generated/prisma';
import { UserRole } from '@nest/shared-types';
import { AuthenticatedRequest } from '../auth/guards/session-auth.guard';

@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER, UserRole.CONTRIBUTOR)
  create(@Body() createAssetDto: any, @Req() req: AuthenticatedRequest) {
    const user = req.user as any;
    return this.assetsService.create(createAssetDto, user.id);
  }

  @Get()
  findAll() {
    return this.assetsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER, UserRole.CONTRIBUTOR)
  update(@Param('id') id: string, @Body() updateAssetDto: any, @Req() req: AuthenticatedRequest) {
    const user = req.user as any;
    return this.assetsService.update(id, updateAssetDto, user.id);
  }

  @Put(':id/status')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER)
  transitionStatus(
    @Param('id') id: string, 
    @Body() body: { status: AssetStatus, notes?: string }, 
    @Req() req: AuthenticatedRequest
  ) {
    const user = req.user as any;
    return this.assetsService.transitionStatus(id, body.status, user.id, body.notes);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const user = req.user as any;
    return this.assetsService.delete(id, user.id);
  }

  @Post(':id/relationships')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER, UserRole.CONTRIBUTOR)
  addRelationship(
    @Param('id') id: string, 
    @Body() body: { childId: string, type: RelationshipType }, 
    @Req() req: AuthenticatedRequest
  ) {
    const user = req.user as any;
    return this.assetsService.addRelationship(id, body.childId, body.type, user.id);
  }

  @Delete(':id/relationships/:childId/:type')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER, UserRole.CONTRIBUTOR)
  removeRelationship(
    @Param('id') id: string, 
    @Param('childId') childId: string,
    @Param('type') type: RelationshipType
  ) {
    return this.assetsService.removeRelationship(id, childId, type);
  }
}
