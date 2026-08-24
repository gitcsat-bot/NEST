import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@nest/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/guards/session-auth.guard';
import { CatalogDeletionRequestsService } from './deletion-requests.service';
import { ListDeletionRequestsQueryDto } from './dto/list-deletion-requests-query.dto';

// Separate top-level resource from CatalogController for the same reason
// materials.controller.ts splits InventoryRequestsController out —
// GET/POST here would otherwise collide with /catalog/:id's route params.
@Controller('catalog-deletion-requests')
export class CatalogDeletionRequestsController {
  constructor(private readonly deletionRequestsService: CatalogDeletionRequestsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  async list(@Query() query: ListDeletionRequestsQueryDto) {
    return this.deletionRequestsService.list({
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.page_size ?? 25,
    });
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id') id: string, @CurrentUser() user: SessionUser, @Req() req: Request) {
    return this.deletionRequestsService.review(id, 'approved', user.id, requestContext(req));
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async reject(@Param('id') id: string, @CurrentUser() user: SessionUser, @Req() req: Request) {
    return this.deletionRequestsService.review(id, 'rejected', user.id, requestContext(req));
  }
}

function requestContext(req: Request) {
  return {
    ipAddress: req.ip ?? 'unknown',
    userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
  };
}
