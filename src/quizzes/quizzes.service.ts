import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AuthenticatedUser } from 'src/auth/authenticated-user.type';

import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { QuizAttemptEntity } from './entities/quiz-attempt.entity';
import { findQuiz, type QuizDefinition } from './quizzes.data';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectRepository(QuizAttemptEntity)
    private readonly attemptsRepository: Repository<QuizAttemptEntity>,
  ) {}

  async getQuiz(quizId: string, user: AuthenticatedUser) {
    const quiz = this.requireQuiz(quizId);

    const lastAttempt = await this.attemptsRepository.findOne({
      where: { quizId, userId: user.id },
      order: { createdAt: 'DESC' },
    });

    return {
      status: 'Success',
      statusCode: 200,
      data: {
        id: quiz.id,
        title: quiz.title,
        subtitle: quiz.subtitle,
        passingScore: quiz.passingScore,
        totalPoints: this.totalPoints(quiz),
        // The answer key (`correct`) is deliberately not sent.
        questions: quiz.questions.map((question) => ({
          id: question.id,
          text: question.text,
          type: question.type,
          points: question.points,
          options: question.options.map(({ id, text }) => ({ id, text })),
        })),
        lastAttempt: lastAttempt
          ? {
              score: lastAttempt.score,
              totalPoints: lastAttempt.totalPoints,
              passed: lastAttempt.passed,
              submittedAt: lastAttempt.createdAt,
            }
          : null,
      },
    };
  }

  async submit(quizId: string, user: AuthenticatedUser, dto: SubmitQuizDto) {
    const quiz = this.requireQuiz(quizId);
    const answersByQuestion = this.indexAnswers(quiz, dto);

    // A question earns its points only when the chosen options exactly match the correct ones.
    const results = quiz.questions.map((question) => {
      const chosen = answersByQuestion.get(question.id) ?? [];
      const correctIds = question.options
        .filter((option) => option.correct)
        .map((option) => option.id);
      const isCorrect =
        chosen.length === correctIds.length &&
        correctIds.every((id) => chosen.includes(id));

      return {
        questionId: question.id,
        correct: isCorrect,
        explanation: question.explanation,
        points: isCorrect ? question.points : 0,
      };
    });

    const score = results.reduce((sum, result) => sum + result.points, 0);
    const totalPoints = this.totalPoints(quiz);
    const passed = score >= quiz.passingScore;

    await this.attemptsRepository.save(
      this.attemptsRepository.create({
        quizId,
        userId: user.id,
        score,
        totalPoints,
        passingScore: quiz.passingScore,
        passed,
        answers: dto.answers.map(({ questionId, optionIds }) => ({
          questionId,
          optionIds,
        })),
      }),
    );

    return {
      status: 'Success',
      statusCode: 201,
      data: {
        score,
        totalPoints,
        passingScore: quiz.passingScore,
        passed,
        results: results.map(({ questionId, correct, explanation }) => ({
          questionId,
          correct,
          explanation,
        })),
      },
    };
  }

  private requireQuiz(quizId: string) {
    const quiz = findQuiz(quizId);
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }
    return quiz;
  }

  private totalPoints(quiz: QuizDefinition) {
    return quiz.questions.reduce((sum, question) => sum + question.points, 0);
  }

  // Rejects answers that don't belong to this quiz; unanswered questions simply score zero.
  private indexAnswers(quiz: QuizDefinition, dto: SubmitQuizDto) {
    const answers = new Map<string, string[]>();

    for (const { questionId, optionIds } of dto.answers) {
      const question = quiz.questions.find((q) => q.id === questionId);
      if (!question) {
        throw new BadRequestException(`Unknown question "${questionId}"`);
      }
      if (answers.has(questionId)) {
        throw new BadRequestException(
          `Question "${questionId}" answered twice`,
        );
      }
      if (question.type === 'single' && optionIds.length > 1) {
        throw new BadRequestException(
          `Question "${questionId}" accepts only one option`,
        );
      }
      const validIds = question.options.map((option) => option.id);
      if (optionIds.some((id) => !validIds.includes(id))) {
        throw new BadRequestException(
          `Unknown option for question "${questionId}"`,
        );
      }
      answers.set(questionId, optionIds);
    }

    return answers;
  }
}
