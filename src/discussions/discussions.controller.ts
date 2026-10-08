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

import { CurrentUser } from 'src/auth/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.type';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

import { DiscussionsService } from './discussions.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  ClassParamDto,
  GetCommentsQueryDto,
} from './dto/get-comments-query.dto';

// Every discussion route needs a logged-in applicant (Authorization: Bearer <jwt>).
@UseGuards(JwtAuthGuard)
@Controller('discussions')
export class DiscussionsController {
  constructor(private readonly discussionsService: DiscussionsService) {}

  @Get(':classId/comments')
  list(
    @Param() { classId }: ClassParamDto,
    @Query() { limit }: GetCommentsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.discussionsService.list(classId, user, limit);
  }

  @Post(':classId/comments')
  create(
    @Param() { classId }: ClassParamDto,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.discussionsService.create(classId, user, dto);
  }

  @Post('comments/:id/like')
  @HttpCode(200)
  toggleLike(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.discussionsService.toggleLike(id, user);
  }
}
