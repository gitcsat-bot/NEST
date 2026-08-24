import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PolymorphicTargetType, ReservationStatus } from '../../generated/prisma';

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createReservation(targetType: PolymorphicTargetType, targetId: string, reservedForUserId: string, requestedByUserId: string, quantity?: number, expiresAt?: Date) {
    return this.prisma.reservation.create({
      data: {
        targetType,
        targetId,
        reservedForUserId,
        requestedByUserId,
        quantity,
        expiresAt,
        status: ReservationStatus.active,
      }
    });
  }

  async findActiveReservationsForUser(userId: string) {
    return this.prisma.reservation.findMany({
      where: {
        reservedForUserId: userId,
        status: ReservationStatus.active,
      }
    });
  }

  async updateReservationStatus(id: string, status: ReservationStatus) {
    return this.prisma.reservation.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
      }
    });
  }
}
