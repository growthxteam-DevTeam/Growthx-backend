import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from 'src/auth/authenticated-user.type';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

import { QuizParamDto, SubmitQuizDto } from './dto/submit-quiz.dto';
import { QuizzesService } from './quizzes.service';

// Every quiz route needs a logged-in learner (Authorization: Bearer <jwt>).
@UseGuards(JwtAuthGuard)
@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Get(':quizId')
  getQuiz(
    @Param() { quizId }: QuizParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizzesService.getQuiz(quizId, user);
  }

  @Post(':quizId/submissions')
  submit(
    @Param() { quizId }: QuizParamDto,
    @Body() dto: SubmitQuizDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizzesService.submit(quizId, user, dto);
  }
}
