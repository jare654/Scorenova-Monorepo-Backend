import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { AccountEntity } from "../../../account/models/accounts/account.entity";
import { SubjectEntity } from "../../../subject/models/subjects/subject.entity";
import { TopicEntity } from "../../../topic/models/topics/topic.entity";
import { QuestionEntity } from "../../../question/models/questions/question.entity";
import { ExamSessionEntity } from "../sessions/exam-session.entity";

@Entity("attempts")
@Index("UQ_attempts_session_question", ["sessionId", "questionId"], { unique: true })
@Index("IDX_attempts_account_id", ["accountId"])
@Index("IDX_attempts_subject_id", ["subjectId"])
@Index("IDX_attempts_topic_id", ["topicId"])
@Index("IDX_attempts_session_id", ["sessionId"])
@Index("IDX_attempts_created_at", ["createdAt"])
@Index("IDX_attempts_is_correct", ["isCorrect"])
export class AttemptEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "session_id" })
  sessionId: string;

  @Column({ name: "account_id" })
  accountId: string;

  @Column({ name: "subject_id" })
  subjectId: string;

  @Column({ name: "question_id" })
  questionId: string;

  @Column({ name: "topic_id", nullable: true })
  topicId: string | null;

  @Column({ name: "selected_answer", type: "text" })
  selectedAnswer: string;

  @Column({ name: "is_correct" })
  isCorrect: boolean;

  @Column({ name: "time_spent_ms", type: "int" })
  timeSpentMs: number;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => ExamSessionEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "session_id" })
  session: ExamSessionEntity;

  @ManyToOne(() => AccountEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account: AccountEntity;

  @ManyToOne(() => SubjectEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "subject_id" })
  subject: SubjectEntity;

  @ManyToOne(() => QuestionEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "question_id" })
  question: QuestionEntity;

  @ManyToOne(() => TopicEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "topic_id" })
  topic: TopicEntity;
}
