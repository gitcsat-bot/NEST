import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CheckoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async checkoutAsset(assetInstanceId: string, heldByUserId: string, userId: string, expectedReturnAt?: Date) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verify asset exists and is available
      const asset = await tx.assetInstance.findUnique({ where: { id: assetInstanceId } });
      if (!asset) throw new NotFoundException('Asset not found');

      // 2. Prevent double-issue (check for active checkouts)
      const existingCheckout = await tx.checkout.findUnique({
        where: { assetInstanceId },
      });
      if (existingCheckout && !existingCheckout.checkedInAt) {
        throw new BadRequestException('Asset is already checked out');
      }

      // 3. Create checkout record
      const checkout = await tx.checkout.create({
        data: {
          assetInstanceId,
          heldByUserId,
          checkedOutByUserId: userId,
          expectedReturnAt,
        },
      });

      // 4. Update asset state (status and current holder)
      await tx.assetInstance.update({
        where: { id: assetInstanceId },
        data: {
          status: 'issued',
          currentHolderUserId: heldByUserId,
          updatedAt: new Date(),
          updatedByUserId: userId,
        },
      });

      return checkout;
    });
  }

  async checkinAsset(assetInstanceId: string, userId: string, condition?: string) {
    return this.prisma.$transaction(async (tx) => {
      const activeCheckout = await tx.checkout.findUnique({
        where: { assetInstanceId },
      });

      if (!activeCheckout || activeCheckout.checkedInAt) {
        throw new BadRequestException('Asset is not currently checked out');
      }

      const updatedCheckout = await tx.checkout.update({
        where: { id: activeCheckout.id },
        data: {
          checkedInAt: new Date(),
          checkedInByUserId: userId,
          conditionAtCheckin: condition,
        },
      });

      await tx.assetInstance.update({
        where: { id: assetInstanceId },
        data: {
          status: 'available',
          currentHolderUserId: null,
          updatedAt: new Date(),
          updatedByUserId: userId,
        },
      });

      return updatedCheckout;
    });
  }

  async findActiveCheckouts() {
    return this.prisma.checkout.findMany({
      where: { checkedInAt: null },
      include: { assetInstance: true, heldBy: true, checkedOutBy: true },
    });
  }
}
