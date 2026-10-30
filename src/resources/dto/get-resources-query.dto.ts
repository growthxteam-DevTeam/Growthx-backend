import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  RESOURCE_CATEGORIES,
  type ResourceCategory,
} from '../resources.sources';

export class GetResourcesQueryDto {
  @IsOptional()
  @IsIn(RESOURCE_CATEGORIES)
  category?: ResourceCategory;

  /** Free-text search the applicant typed, matched against titles and summaries. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;
}
