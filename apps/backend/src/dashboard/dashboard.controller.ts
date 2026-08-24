import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { SessionAuthGuard as JwtAuthGuard } from '../auth/guards/session-auth.guard';
import { AuthenticatedRequest } from '../auth/guards/session-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    return this.dashboardService.getDashboardMetrics(user.role, user.id);
  }
}
