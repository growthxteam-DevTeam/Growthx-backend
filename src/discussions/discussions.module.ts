import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApplicationEntity } from 'src/applications/entities/application.entity';
import { AuthModule } from 'src/auth/auth.module';

import { DiscussionsController } from './discussions.controller';
import { DiscussionsService } from './discussions.service';
import { DiscussionCommentEntity } from './entities/discussion-comment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DiscussionCommentEntity, ApplicationEntity]),
    AuthModule,
  ],
  controllers: [DiscussionsController],
  providers: [DiscussionsService],
})
export class DiscussionsModule {}
