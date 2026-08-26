import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import { QuotationsService } from './quotations.service';
import { SessionAuthGuard, AuthenticatedRequest } from '../auth/guards/session-auth.guard';
import { QuotationStatus } from '../../generated/prisma';

// Ensure upload directory exists
const uploadDir = './uploads/quotations';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@Controller('quotations')
@UseGuards(SessionAuthGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  findAll() {
    return this.quotationsService.findAll();
  }

  @Post()
  @UseInterceptors(FileInterceptor('pdf', {
    storage: diskStorage({
      destination: './uploads/quotations',
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
      }
    })
  }))
  create(
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest
  ) {
    const user = req.user as any;
    return this.quotationsService.create({
      name: body.name,
      tenderType: body.tenderType,
      amount: parseFloat(body.amount),
      validTill: body.validTill ? new Date(body.validTill) : undefined,
      pdfUrl: file ? `/quotations/pdf/${file.filename}` : undefined,
    }, user.id);
  }

  @Get('pdf/:filename')
  getPDF(@Param('filename') filename: string, @Res() res: any) {
    return res.sendFile(filename, { root: './uploads/quotations' });
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: QuotationStatus) {
    return this.quotationsService.updateStatus(id, status);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.quotationsService.delete(id);
  }
}
