import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { COHORTS, PROGRAMS } from '../dashboard.constants';

export class UpsertBannerDto {
  @IsIn(PROGRAMS, { message: 'Unknown program' })
  program!: string;

  @IsIn(COHORTS, { message: 'Unknown cohort' })
  cohort!: string;

  @IsNotEmpty({ message: 'Title is required' })
  @IsString()
  @MaxLength(100)
  title!: string;

  @IsInt({ message: 'Duration must be a whole number of weeks' })
  @Min(1)
  @Max(104)
  durationWeeks!: number;

  @IsNotEmpty({ message: 'Leader is required' })
  @IsString()
  @MaxLength(100)
  leader!: string;

  @IsInt({ message: 'Cohort members must be a whole number' })
  @Min(0)
  @Max(100000)
  cohortMembers!: number;
}
