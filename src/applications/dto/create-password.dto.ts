import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class CreatePasswordDto {
  @IsNotEmpty({ message: 'GS code is required' })
  @IsString()
  gsCode!: string;

  // Rules mirror createPasswordSchema in the frontend (app/(auth)/create-password).
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/\d/, { message: 'Password must contain a number' })
  @Matches(/[A-Z]/, { message: 'Password must contain an uppercase letter' })
  @Matches(/[^A-Za-z0-9]/, {
    message: 'Password must contain a special character',
  })
  password!: string;
}
