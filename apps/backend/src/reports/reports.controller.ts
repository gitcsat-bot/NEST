import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@nest/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { ReportWindowQueryDto } from './dto/report-window-query.dto';

// Implementation Plan checklist item 5 — admin gets security, login, and
// inventory reports. All three are ADMIN-only; read-only, so no step-up
// (see Security Design §6's step-up list — reports aren't on it).
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Roles(UserRole.ADMIN)
  @Get('security')
  async security(@Query() query: ReportWindowQueryDto) {
    return this.reportsService.securityReport(query.days ?? 30);
  }

  @Roles(UserRole.ADMIN)
  @Get('logins')
  async logins(@Query() query: ReportWindowQueryDto) {
    return this.reportsService.loginReport(query.days ?? 30);
  }

  @Roles(UserRole.ADMIN)
  @Get('inventory')
  async inventory() {
    return this.reportsService.inventoryReport();
  }
}
