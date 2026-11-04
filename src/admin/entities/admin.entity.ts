import { Entity, ObjectIdColumn, Column, CreateDateColumn } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Exclude, Transform } from 'class-transformer';

// Staff accounts that can review applications. Kept apart from ApplicationEntity: an admin has no
// application, and a learner must never be able to become one. Seeded by AdminSeederService.
@Entity('admins')
export class AdminEntity {
  @ObjectIdColumn({ primary: true, generated: 'uuid' })
  @Transform(({ value }) => value?.toString())
  _id!: ObjectId;

  @Column()
  name!: string;

  // Stored lower-cased so login can match it exactly.
  @Column()
  email!: string;

  @Exclude()
  @Column()
  passwordHash!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
