import { ObjectId } from 'mongodb';
import { Column, CreateDateColumn, Entity, ObjectIdColumn } from 'typeorm';

// One discussion message. Top-level comments have no parentId; replies point at a
// top-level comment (one level of nesting only).
@Entity('discussion_comments')
export class DiscussionCommentEntity {
  @ObjectIdColumn()
  _id!: ObjectId;

  /** Which thread this belongs to, e.g. "week-1-pricing-your-product". */
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

  // The fields below were added after the first comments were saved, so older documents
  // lack them — always read them with a fallback.

  /** Author ids that liked this comment. */
  @Column()
  likedBy!: string[];

  /** Author ids that disliked this comment (a user is never in both lists). */
  @Column({ nullable: true })
  dislikedBy?: string[];

  /** Kept equal to likedBy.length so "top" sorting can happen in the database. */
  @Column({ nullable: true })
  likeCount?: number;

  /** Pinned comments sort above the rest. No endpoint sets this yet — change it in the database. */
  @Column({ nullable: true })
  pinned?: boolean;

  /** Marks a post written by staff, shown as a badge. Also set in the database for now. */
  @Column({ nullable: true })
  staffPost?: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
