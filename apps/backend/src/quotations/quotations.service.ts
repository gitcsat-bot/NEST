import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuotationStatus } from '../../generated/prisma';

@Injectable()
export class QuotationsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.quotation.findMany({
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { displayName: true } } }
    });
  }

  async create(data: { name: string; tenderType: string; amount: number; validTill?: Date; pdfUrl?: string }, userId: string) {
    return this.prisma.quotation.create({
      data: {
        name: data.name,
        tenderType: data.tenderType,
        amount: data.amount,
        validTill: data.validTill,
        pdfUrl: data.pdfUrl,
        createdByUserId: userId,
      }
    });
  }

  async updateStatus(id: string, status: QuotationStatus) {
    const q = await this.prisma.quotation.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Quotation not found');
    return this.prisma.quotation.update({
      where: { id },
      data: { status }
    });
  }

  async delete(id: string) {
    return this.prisma.quotation.delete({ where: { id } });
  }
}
