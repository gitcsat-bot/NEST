import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@nest/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/guards/session-auth.guard';
import { CatalogService } from './catalog.service';
import { CatalogDeletionRequestsService } from './deletion-requests.service';
import { CreateAssetDefinitionDto } from './dto/create-asset-definition.dto';
import { UpdateAssetDefinitionDto } from './dto/update-asset-definition.dto';
import { ListAssetDefinitionsQueryDto } from './dto/list-asset-definitions-query.dto';
import { CreateDeletionRequestDto } from './dto/create-deletion-request.dto';

// API Contract §7.1 — CRUD for Asset Definitions (Catalog).
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly deletionRequestsService: CatalogDeletionRequestsService,
  ) {}

  @Get()
  @Roles(UserRole.VIEWER)
  async list(@Query() query: ListAssetDefinitionsQueryDto) {
    return this.catalogService.findAll({
      search: query.search,
      isConsumable: query.is_consumable,
      page: query.page ?? 1,
      pageSize: query.page_size ?? 25,
    });
  }

  @Get(':id')
  @Roles(UserRole.VIEWER)
  async getById(@Param('id') id: string) {
    return this.catalogService.findById(id);
  }

  @Post()
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateAssetDefinitionDto, @CurrentUser() caller: SessionUser) {
    return this.catalogService.create(dto, caller.id);
  }

  @Patch(':id')
  @Roles(UserRole.STUDENT)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetDefinitionDto,
    @CurrentUser() caller: SessionUser,
  ) {
    return this.catalogService.update(id, dto, caller.id);
  }

  // Admin's direct, immediate delete — unchanged.
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @CurrentUser() caller: SessionUser) {
    return this.catalogService.remove(id, caller.id);
  }

  // Student-side (and up) equivalent: request deletion, subject to admin
  // review — see deletion-requests.controller.ts for the approve/reject
  // side of this workflow.
  @Post(':id/deletion-requests')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  async requestDeletion(
    @Param('id') id: string,
    @Body() dto: CreateDeletionRequestDto,
    @CurrentUser() caller: SessionUser,
    @Req() req: Request,
  ) {
    return this.deletionRequestsService.create(id, dto, caller.id, requestContext(req));
  }
}

function requestContext(req: Request) {
  return {
    ipAddress: req.ip ?? 'unknown',
    userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
  };
}
