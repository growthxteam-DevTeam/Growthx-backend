import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AdminApplicationsService } from './admin-applications.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard } from './admin.guard';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly adminApplicationsService: AdminApplicationsService,
  ) {}

  // Public — exchanges the seeded admin email + password for an admin JWT.
  @Post('auth/login')
  @HttpCode(200)
  login(@Body() adminLoginDto: AdminLoginDto) {
    return this.adminAuthService.login(adminLoginDto);
  }

  @UseGuards(AdminGuard)
  @Get('applications')
  listApplications(@Query() query: ListApplicationsQueryDto) {
    return this.adminApplicationsService.list(query);
  }

  @UseGuards(AdminGuard)
  @Post('applications/:id/invite')
  @HttpCode(200)
  inviteApplicant(@Param('id') id: string) {
    return this.adminApplicationsService.invite(id);
  }

  @UseGuards(AdminGuard)
  @Post('applications/:id/reject')
  @HttpCode(200)
  rejectApplicant(@Param('id') id: string) {
    return this.adminApplicationsService.reject(id);
  }
}
