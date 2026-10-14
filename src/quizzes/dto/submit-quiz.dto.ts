import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class QuizParamDto {
  @Matches(/^[a-z0-9-]{1,100}$/i, { message: 'Invalid quiz id' })
  quizId!: string;
}

export class QuizAnswerDto {
  @IsString()
  @MaxLength(50)
  questionId!: string;

  @IsArray()
  @ArrayUnique({ message: 'Each option can only be chosen once' })
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  optionIds!: string[];
}

export class SubmitQuizDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers!: QuizAnswerDto[];
}
