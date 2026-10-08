import { ObjectId } from 'mongodb';
import { Column, CreateDateColumn, Entity, ObjectIdColumn } from 'typeorm';

// One discussion message. Top-level comments have no parentId; replies point at a
// top-level comment (one level of nesting only).
@Entity('discussion_comments')
export class DiscussionCommentEntity {
  @ObjectIdColumn()
  _id!: ObjectId;

  /** Which class thread this belongs to, e.g. "week-1-pricing-your-product". */
  @Column()
  classId!: string;

  /** Id of the author's application record (JWT `sub`). */
  @Column()
  authorId!: string;

  // Name and photo are copied at write time so listing comments needs no extra lookups.
  @Column()
  authorName!: string;

  @Column({ nullable: true })
  authorPicture?: string;

  @Column()
  content!: string;

  @Column({ nullable: true })
  parentId?: string;

  /** Author ids that liked this comment. */
  @Column()
  likedBy!: string[];

  @CreateDateColumn()
  createdAt!: Date;
}
