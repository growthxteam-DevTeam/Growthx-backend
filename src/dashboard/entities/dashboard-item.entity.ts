import { Entity, ObjectIdColumn, Column, CreateDateColumn } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Transform } from 'class-transformer';

import {
  DASHBOARD_ITEM_TYPES,
  type DashboardItemType,
} from '../dashboard.constants';

// One entry on the learner dashboard: an announcement, a calendar event or a to-do assignment.
// The three share a collection because they only differ in which of `date` / `points` they use:
// announcements use neither, events use `date`, assignments use `date` (the due date) and `points`.
@Entity('dashboard_items')
export class DashboardItemEntity {
  @ObjectIdColumn({ primary: true, generated: 'uuid' })
  @Transform(({ value }) => value?.toString())
  _id!: ObjectId;

  @Column({ type: 'enum', enum: DASHBOARD_ITEM_TYPES })
  type!: DashboardItemType;

  // Audience. null means "everyone" and must be stored as an explicit null (TypeORM skips
  // undefined), because the learner query matches on `$in: [null, <their value>]`.
  @Column({ nullable: true })
  program!: string | null;

  @Column({ nullable: true })
  cohort!: string | null;

  // The announcement message, event title or assignment title.
  @Column()
  text!: string;

  @Column({ nullable: true })
  date!: Date | null;

  @Column({ nullable: true })
  points!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
