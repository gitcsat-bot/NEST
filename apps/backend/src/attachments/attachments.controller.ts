import { Controller, Post, Get, Delete, Param, UseGuards, Req, Body } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { SessionAuthGuard as JwtAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PolymorphicTargetType } from '../../generated/prisma';
import { AuthenticatedRequest } from '../auth/guards/session-auth.guard';

@Controller('attachments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post(':targetType/:targetId')
  upload(
    @Param('targetType') targetType: PolymorphicTargetType,
    @Param('targetId') targetId: string,
    @Body() fileMeta: any, // E.g., simulated file metadata
    @Req() req: AuthenticatedRequest
  ) {
    const user = req.user as any;
    return this.attachmentsService.uploadAttachment(targetType, targetId, fileMeta, user.id);
  }

  @Get(':targetType/:targetId')
  findByTarget(
    @Param('targetType') targetType: PolymorphicTargetType,
    @Param('targetId') targetId: string
  ) {
    return this.attachmentsService.getAttachmentsForTarget(targetType, targetId);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.attachmentsService.deleteAttachment(id);
  }
}
