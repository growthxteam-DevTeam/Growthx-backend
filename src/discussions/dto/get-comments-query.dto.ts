import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

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
}
