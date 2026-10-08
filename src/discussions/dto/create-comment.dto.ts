import { Transform } from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCommentDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: 'Comment cannot be empty' })
  @IsString()
  @MaxLength(1000, { message: 'Comment must be at most 1000 characters' })
  content!: string;

  /** Set when replying; must be the id of a top-level comment in the same class. */
  @IsOptional()
  @IsMongoId({ message: 'Invalid parent comment' })
  parentId?: string;
}
