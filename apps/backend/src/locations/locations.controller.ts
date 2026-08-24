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
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationQueryDto } from './dto/location-query.dto';
import { UpdateLocationStatusDto } from './dto/update-location-status.dto';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Roles(UserRole.VIEWER)
  @Get()
  async findAll(@Query() query: LocationQueryDto) {
    return this.locationsService.findAll(query);
  }

  @Roles(UserRole.VIEWER)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }

  @Roles(UserRole.STUDENT)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateLocationDto,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ) {
    return this.locationsService.create(dto, user.id, requestContext(req));
  }

  @Roles(UserRole.STUDENT)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ) {
    return this.locationsService.update(id, dto, user.id, requestContext(req));
  }

  @Roles(UserRole.STUDENT)
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLocationStatusDto,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ) {
    return this.locationsService.updateStatus(id, dto.status, user.id, requestContext(req));
  }

  @Roles(UserRole.STORES_MANAGER)
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ) {
    return this.locationsService.archive(id, user.id, requestContext(req));
  }
}

function requestContext(req: Request) {
  return {
    ipAddress: req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
  };
}
