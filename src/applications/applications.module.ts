import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CloudinaryModule } from 'src/utility/cloudinary/cloudinary.module';

import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationEntity } from './entities/application.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ApplicationEntity]), CloudinaryModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
