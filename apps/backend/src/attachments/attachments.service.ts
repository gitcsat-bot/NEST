import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PolymorphicTargetType, AttachmentStatus } from '../../generated/prisma';

@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadAttachment(targetType: PolymorphicTargetType, targetId: string, file: any, userId: string) {
    // Mock implementation for MVP. In reality, upload to S3 or save to disk.
    // Assuming 'file' contains filename, mimetype, size etc.
    const storageKey = `uploads/${Date.now()}_${file.originalname}`;
    
    return this.prisma.attachment.create({
      data: {
        targetType,
        targetId,
        storageKey,
        originalFilename: file.originalname,
        declaredMimeType: file.mimetype,
        sizeBytes: file.size,
        status: AttachmentStatus.available,
        uploadedByUserId: userId,
      }
    });
  }

  async getAttachmentsForTarget(targetType: PolymorphicTargetType, targetId: string) {
    return this.prisma.attachment.findMany({
      where: {
        targetType,
        targetId,
        deletedAt: null,
      }
    });
  }

  async deleteAttachment(id: string) {
    return this.prisma.attachment.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
