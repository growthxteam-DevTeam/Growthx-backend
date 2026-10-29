import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BachsModule } from 'src/utility/bachs/bachs.module';
import { CloudinaryModule } from 'src/utility/cloudinary/cloudinary.module';
import { MailModule } from 'src/utility/mail/mail.module';

import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationEntity } from './entities/application.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApplicationEntity]),
    CloudinaryModule,
    MailModule,
    BachsModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
