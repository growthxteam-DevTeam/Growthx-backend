import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class AdminLoginDto {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  password!: string;
}
