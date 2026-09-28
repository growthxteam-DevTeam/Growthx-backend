import { Column } from 'typeorm';

// Embedded sub-documents — each one mirrors a screen/tab of the frontend
// onboarding wizard (growth-x/app/(auth)/onboarding), so the stored record
// reads the same way the applicant filled it in rather than as one flat
// bag of fields.

export class ApplicationPortalGroup {
  @Column()
  fullName!: string;

  @Column()
  email!: string;

  @Column()
  program!: string;

  @Column({ nullable: true })
  cohort?: string;
}

export class PersonalInfoGroup {
  @Column({ nullable: true })
  title?: string;

  @Column()
  surname!: string;

  @Column()
  firstName!: string;

  @Column()
  businessName!: string;

  @Column()
  dateOfBirth!: Date;

  @Column()
  gender!: string;
}

export class BusinessBasicsGroup {
  @Column()
  businessDescription!: string;

  @Column({
    type: 'enum',
    enum: ['less-than-6-months', '6-months-to-1-year', '1-3-years', '3-5-years', 'more-than-5-years'],
  })
  operatingDuration!: string;

  @Column({
    type: 'enum',
    enum: ['no-revenue-yet', 'early-revenue', 'growing-revenue', 'significant-revenue'],
  })
  averageRevenue!: string;

  @Column({ type: 'enum', enum: ['full-time', 'not-yet'] })
  fullTimeCommitment!: string;
}

export class WhoYouAreGroup {
  @Column()
  challengeAndSkillGap!: string;

  @Column()
  cohortMotivation!: string;
}

export class AccessibilitySupportGroup {
  @Column({ type: 'enum', enum: ['yes', 'no'] })
  hasAccessibilityNeeds!: 'yes' | 'no';
}

export class SubmitGroup {
  @Column({ nullable: true })
  passportPhotoUrl?: string;
}
