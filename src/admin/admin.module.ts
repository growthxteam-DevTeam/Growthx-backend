import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApplicationEntity } from 'src/applications/entities/application.entity';
import { AuthModule } from 'src/auth/auth.module';
import { MailModule } from 'src/utility/mail/mail.module';

import { AdminApplicationsService } from './admin-applications.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminSeederService } from './admin-seeder.service';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminEntity } from './entities/admin.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminEntity, ApplicationEntity]),
    AuthModule, // exports JwtModule, which signs and verifies the admin token
    MailModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminAuthService,
    AdminApplicationsService,
    AdminSeederService,
    AdminGuard,
  ],
})
export class AdminModule {}
