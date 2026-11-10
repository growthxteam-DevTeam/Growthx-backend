import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AdminGuard } from 'src/admin/admin.guard';

import { AdminDashboardService } from './admin-dashboard.service';
import {
  CreateDashboardItemDto,
  ListDashboardItemsQueryDto,
  UpdateDashboardItemDto,
} from './dto/dashboard-item.dto';
import { UpsertBannerDto } from './dto/upsert-banner.dto';

// Admin — manages what learners see on their dashboard.
@UseGuards(AdminGuard)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('items')
  listItems(@Query() query: ListDashboardItemsQueryDto) {
    return this.adminDashboardService.listItems(query.type);
  }

  @Post('items')
  createItem(@Body() dto: CreateDashboardItemDto) {
    return this.adminDashboardService.createItem(dto);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateDashboardItemDto) {
    return this.adminDashboardService.updateItem(id, dto);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string) {
    return this.adminDashboardService.removeItem(id);
  }

  @Get('banners')
  listBanners() {
    return this.adminDashboardService.listBanners();
  }

  // Create or replace the banner for a program + cohort.
  @Put('banners')
  @HttpCode(200)
  upsertBanner(@Body() dto: UpsertBannerDto) {
    return this.adminDashboardService.upsertBanner(dto);
  }

  @Delete('banners/:id')
  removeBanner(@Param('id') id: string) {
    return this.adminDashboardService.removeBanner(id);
  }
}
