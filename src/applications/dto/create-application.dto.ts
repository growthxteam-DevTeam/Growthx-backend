import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const ACCESSIBILITY_NEEDS = [
  'vision',
  'hearing',
  'mobility',
  'cognitive',
  'speech',
  'other',
  'undisclosed',
];

export class CreateApplicationDto {
  // Application Portal
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString()
  @MinLength(2, { message: 'Full name is required' })
  fullName!: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;

  @IsNotEmpty({ message: 'Select a program' })
  @IsString()
  program!: string;

  @IsOptional()
  @IsString()
  cohort?: string;

  // Personal Information
  @IsOptional()
  @IsString()
  title?: string;

  @IsNotEmpty({ message: 'Surname is required' })
  @IsString()
  surname!: string;

  @IsNotEmpty({ message: 'First name is required' })
  @IsString()
  firstName!: string;

  @IsNotEmpty({ message: 'Business name is required' })
  @IsString()
  businessName!: string;

  @IsNotEmpty({ message: 'Date of birth is required' })
  @Type(() => Date)
  @IsDate({ message: 'Date of birth is required' })
  dateOfBirth!: Date;

  @IsNotEmpty({ message: 'Select a gender' })
  @IsString()
  gender!: string;

  // Business Basics
  @IsNotEmpty()
  @IsString()
  @MinLength(10, { message: 'Tell us more about your business' })
  businessDescription!: string;

  @IsNotEmpty({ message: "Select how long you've been operating" })
  @IsIn(
    [
      'less-than-6-months',
      '6-months-to-1-year',
      '1-3-years',
      '3-5-years',
      'more-than-5-years',
    ],
    {
      message: "Select how long you've been operating",
    },
  )
  operatingDuration!: string;

  @IsNotEmpty({ message: 'Select your average revenue' })
  @IsIn(
    [
      'no-revenue-yet',
      'early-revenue',
      'growing-revenue',
      'significant-revenue',
    ],
    {
      message: 'Select your average revenue',
    },
  )
  averageRevenue!: string;

  @IsNotEmpty({ message: 'Select an option' })
  @IsIn(['full-time', 'not-yet'], { message: 'Select an option' })
  fullTimeCommitment!: string;

  // Who You Are
  @IsNotEmpty()
  @IsString()
  @MinLength(10, { message: 'Tell us more — both the win and the gap' })
  challengeAndSkillGap!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(10, {
    message: 'Tell us more about why now and what outcome you want',
  })
  cohortMotivation!: string;

  // Accessibility & Support
  @IsNotEmpty({ message: 'Please select an option' })
  @IsIn(['yes', 'no'], { message: 'Please select an option' })
  hasAccessibilityNeeds!: 'yes' | 'no';

  @ValidateIf((o: CreateApplicationDto) => o.hasAccessibilityNeeds === 'yes')
  @IsNotEmpty({ message: 'Please select an option' })
  @IsIn(ACCESSIBILITY_NEEDS, { message: 'Please select an option' })
  accessibilityNeed?: string;
}
