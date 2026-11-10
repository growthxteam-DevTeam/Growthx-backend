import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminGuard } from 'src/admin/admin.guard';
import { ApplicationEntity } from 'src/applications/entities/application.entity';
import { AuthModule } from 'src/auth/auth.module';

import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardBannerEntity } from './entities/dashboard-banner.entity';
import { DashboardItemEntity } from './entities/dashboard-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DashboardItemEntity,
      DashboardBannerEntity,
      ApplicationEntity,
    ]),
    AuthModule, // exports JwtModule, which both guards use to verify tokens
  ],
  controllers: [DashboardController, AdminDashboardController],
  providers: [DashboardService, AdminDashboardService, AdminGuard],
})
export class DashboardModule {}
