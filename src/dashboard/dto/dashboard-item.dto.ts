import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import {
  COHORTS,
  DASHBOARD_ITEM_TYPES,
  PROGRAMS,
  type DashboardItemType,
} from '../dashboard.constants';

export const ITEM_TEXT_MAX_LENGTH = 500;
export const MAX_POINTS = 1000;

export class ListDashboardItemsQueryDto {
  @IsIn(DASHBOARD_ITEM_TYPES, {
    message: 'type must be announcement, event or assignment',
  })
  type!: DashboardItemType;
}

export class CreateDashboardItemDto {
  @IsIn(DASHBOARD_ITEM_TYPES, {
    message: 'type must be announcement, event or assignment',
  })
  type!: DashboardItemType;

  // Omit or send null for "every program" / "every cohort".
  @IsOptional()
  @IsIn(PROGRAMS, { message: 'Unknown program' })
  program?: string | null;

  @IsOptional()
  @IsIn(COHORTS, { message: 'Unknown cohort' })
  cohort?: string | null;

  @IsNotEmpty({ message: 'Text is required' })
  @IsString()
  @MaxLength(ITEM_TEXT_MAX_LENGTH)
  text!: string;

  // The event date, or the assignment's due date. Not used by announcements.
  @ValidateIf((item: CreateDashboardItemDto) => item.type !== 'announcement')
  @Type(() => Date)
  @IsDate({ message: 'A valid date is required' })
  date?: Date;

  @ValidateIf((item: CreateDashboardItemDto) => item.type === 'assignment')
  @IsInt({ message: 'Points must be a whole number' })
  @Min(0)
  @Max(MAX_POINTS)
  points?: number;
}

// The type is fixed once an item exists; everything else can change. Fields that don't apply to the
// item's type (a date on an announcement) are ignored by the service.
export class UpdateDashboardItemDto {
  @IsOptional()
  @IsIn(PROGRAMS, { message: 'Unknown program' })
  program?: string | null;

  @IsOptional()
  @IsIn(COHORTS, { message: 'Unknown cohort' })
  cohort?: string | null;

  @IsOptional()
  @IsNotEmpty({ message: 'Text is required' })
  @IsString()
  @MaxLength(ITEM_TEXT_MAX_LENGTH)
  text?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'A valid date is required' })
  date?: Date;

  @IsOptional()
  @IsInt({ message: 'Points must be a whole number' })
  @Min(0)
  @Max(MAX_POINTS)
  points?: number;
}
