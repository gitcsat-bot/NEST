import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@nest/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/guards/session-auth.guard';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialStatusDto } from './dto/update-material-status.dto';
import { CreateInventoryRequestDto } from './dto/create-inventory-request.dto';
import { ListMaterialsQueryDto } from './dto/list-materials-query.dto';
import { ListInventoryRequestsQueryDto } from './dto/list-inventory-requests-query.dto';

// Materials MVP — Implementation Plan checklist items 4/5 (see the doc
// comment on the `Material` model in schema.prisma for scope notes).
//
// Role gating, matching the original checklist:
//   - viewer:  read-only (list/get materials, see a material's request history)
//   - student: + change a material's status, + submit an inventory request
//   - admin:   + create materials, + review (approve/reject) inventory requests
// `student` is the floor for the two write actions, so `admin` and
// `stores_manager` inherit them automatically via the existing role
// hierarchy (roleAtLeast) — no separate admin-only duplicate routes needed.
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Roles(UserRole.VIEWER)
  @Get()
  async findAll(@Query() query: ListMaterialsQueryDto) {
    return this.materialsService.findAll({
      status: query.status,
      locationId: query.location_id,
      assetDefinitionId: query.asset_definition_id,
      page: query.page ?? 1,
      pageSize: query.page_size ?? 25,
    });
  }

  @Roles(UserRole.VIEWER)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.materialsService.findById(id);
  }

  @Roles(UserRole.STUDENT)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateMaterialDto, @CurrentUser() user: SessionUser, @Req() req: Request) {
    return this.materialsService.create(dto, user.id, requestContext(req));
  }

  @Roles(UserRole.STUDENT)
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMaterialStatusDto,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ) {
    return this.materialsService.updateStatus(id, dto.status, user.id, requestContext(req));
  }

  @Roles(UserRole.VIEWER)
  @Get(':id/inventory-requests')
  async listRequestsForMaterial(@Param('id') id: string) {
    return this.materialsService.listInventoryRequestsForMaterial(id);
  }

  @Roles(UserRole.STUDENT)
  @Post(':id/inventory-requests')
  @HttpCode(HttpStatus.CREATED)
  async requestQuantity(
    @Param('id') id: string,
    @Body() dto: CreateInventoryRequestDto,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ) {
    return this.materialsService.createInventoryRequest(id, dto, user.id, requestContext(req));
  }
}

// Separate top-level resource for the admin review queue, so
// GET /inventory-requests?status=pending doesn't need a material id.
@Controller('inventory-requests')
export class InventoryRequestsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  async list(@Query() query: ListInventoryRequestsQueryDto) {
    return this.materialsService.listInventoryRequests({
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.page_size ?? 25,
    });
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id') id: string, @CurrentUser() user: SessionUser, @Req() req: Request) {
    return this.materialsService.reviewInventoryRequest(id, 'approved', user.id, requestContext(req));
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(@Param('id') id: string, @CurrentUser() user: SessionUser, @Req() req: Request) {
    return this.materialsService.reviewInventoryRequest(id, 'rejected', user.id, requestContext(req));
  }
}

function requestContext(req: Request) {
  return {
    ipAddress: req.ip ?? 'unknown',
    userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
  };
}
