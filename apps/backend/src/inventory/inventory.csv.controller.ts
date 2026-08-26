import { Controller, Get, Post, UseGuards, Req, UseInterceptors, UploadedFile, Res, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InventoryCsvService } from './inventory.csv.service';
import { SessionAuthGuard as JwtAuthGuard, AuthenticatedRequest } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@nest/shared-types';
import { Response } from 'express';

@Controller('inventory/csv')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryCsvController {
  constructor(private readonly csvService: InventoryCsvService) {}

  @Get('template')
  @Roles(UserRole.ADMIN, UserRole.STORES_MANAGER)
  downloadTemplate(@Res() res: Response) {
    const csv = this.csvService.generateTemplate();
    res.header('Content-Type', 'text/csv');
    res.attachment('inventory_template.csv');
    return res.send(csv);
  }

  @Post('upload')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async uploadCsv(@UploadedFile() file: Express.Multer.File, @Req() req: AuthenticatedRequest) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const user = req.user as any;
    const csvContent = file.buffer.toString('utf8');
    return this.csvService.processCsv(csvContent, user.id);
  }
}
