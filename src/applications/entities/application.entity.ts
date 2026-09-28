import { Entity, ObjectIdColumn, Column, CreateDateColumn } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Transform } from 'class-transformer';
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

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.PENDING,
  })
  status!: ApplicationStatus;

  @CreateDateColumn()
  createdAt!: Date;
}
