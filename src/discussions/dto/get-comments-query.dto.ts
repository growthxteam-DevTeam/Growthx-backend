import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export const COMMENT_SORTS = ['newest', 'oldest', 'top'] as const;
export type CommentSort = (typeof COMMENT_SORTS)[number];

export class ClassParamDto {
  @Matches(/^[a-z0-9-]{1,100}$/i, { message: 'Invalid class id' })
  classId!: string;
}

export class GetCommentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsIn(COMMENT_SORTS, { message: 'sort must be newest, oldest or top' })
  sort?: CommentSort;
}
