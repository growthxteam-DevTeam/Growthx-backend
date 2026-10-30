import { Entity, ObjectIdColumn, Column, CreateDateColumn } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Exclude, Transform } from 'class-transformer';
import { ApplicationStatus } from 'src/utility/common/application-status.enum';
import {
  AccessibilitySupportGroup,
  ApplicationPortalGroup,
  BusinessBasicsGroup,
  PersonalInfoGroup,
  SubmitGroup,
  WhoYouAreGroup,
} from './application-groups.entity';

@Entity('applications')
export class ApplicationEntity {
  @ObjectIdColumn({ primary: true, generated: 'uuid' })
  @Transform(({ value }) => value?.toString())
  _id!: ObjectId;

  @Column(() => ApplicationPortalGroup)
  applicationPortal!: ApplicationPortalGroup;

  @Column(() => PersonalInfoGroup)
  personalInfo!: PersonalInfoGroup;

  @Column(() => BusinessBasicsGroup)
  businessBasics!: BusinessBasicsGroup;

  @Column(() => WhoYouAreGroup)
  whoYouAre!: WhoYouAreGroup;

  @Column(() => AccessibilitySupportGroup)
  accessibilitySupport!: AccessibilitySupportGroup;

  @Column(() => SubmitGroup)
  submit!: SubmitGroup;

  // Emailed to the applicant as proof of ownership of their address, so it
  // must never be echoed back in the API response.
  @Exclude()
  @Column()
  gsCode!: string;

  // Set once by POST /applications/create-password; its presence marks the GS code as used.
  @Exclude()
  @Column({ nullable: true })
  passwordHash?: string;

  // SHA-256 of the emailed password-reset token (never the token itself) and when it stops working.
  // Both are set to null (not undefined — TypeORM skips undefined on save) once the password is reset.
  @Exclude()
  @Column({ nullable: true })
  passwordResetTokenHash?: string | null;

  @Exclude()
  @Column({ nullable: true })
  passwordResetExpiresAt?: Date | null;

  // True for applications created once payment was introduced. Older records leave it unset, so
  // applicants who already hold a GS code aren't suddenly asked to pay.
  @Exclude()
  @Column({ nullable: true })
  paymentRequired?: boolean;

  // Bachs checkout session id; the payment webhook finds the application by it.
  @Exclude()
  @Column({ nullable: true })
  bachsCheckoutId?: string;

  // Set once Bachs confirms the payment; the GS code email goes out at that moment.
  @Column({ nullable: true })
  paidAt?: Date;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.PENDING,
  })
  status!: ApplicationStatus;

  @CreateDateColumn()
  createdAt!: Date;
}
