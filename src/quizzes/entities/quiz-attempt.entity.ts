import { ObjectId } from 'mongodb';
import { Column, CreateDateColumn, Entity, ObjectIdColumn } from 'typeorm';

export interface QuizAttemptAnswer {
  questionId: string;
  optionIds: string[];
}

// One submission. Learners can retake a quiz, so there can be several per user and quiz.
@Entity('quiz_attempts')
export class QuizAttemptEntity {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column()
  quizId!: string;

  /** Id of the learner's application record (JWT `sub`). */
  @Column()
  userId!: string;

  @Column()
  score!: number;

  @Column()
  totalPoints!: number;

  /** Snapshot of the pass mark when the quiz was taken, in case it changes later. */
  @Column()
  passingScore!: number;

  @Column()
  passed!: boolean;

  // A plain column, not an embedded `@Column(() => ...)`: TypeORM's Mongo driver saves embedded arrays as a
  // single object, which then crashes when the document is loaded back.
  @Column()
  answers!: QuizAttemptAnswer[];

  @CreateDateColumn()
  createdAt!: Date;
}
