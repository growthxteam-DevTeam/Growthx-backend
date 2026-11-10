import { Controller, Get, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from 'src/auth/authenticated-user.type';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // JWT — the caller's dashboard content (banner, announcements, calendar events, to-do list).
  @UseGuards(JwtAuthGuard)
  @Get()
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getForApplicant(user.id);
  }
}
