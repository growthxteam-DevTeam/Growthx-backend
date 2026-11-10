import { Entity, ObjectIdColumn, Column } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Transform } from 'class-transformer';

// The program banner on the learner dashboard. One per program + cohort (the pair is unique:
// AdminDashboardService upserts on it).
@Entity('dashboard_banners')
export class DashboardBannerEntity {
  @ObjectIdColumn({ primary: true, generated: 'uuid' })
  @Transform(({ value }) => value?.toString())
  _id!: ObjectId;

  @Column()
  program!: string;

  @Column()
  cohort!: string;

  @Column()
  title!: string;

  @Column()
  durationWeeks!: number;

  @Column()
  leader!: string;

  @Column()
  cohortMembers!: number;
}
