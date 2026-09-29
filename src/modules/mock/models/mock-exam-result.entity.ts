import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { AccountEntity } from "../../account/models/accounts/account.entity";
import { SubjectEntity } from "../../subject/models/subjects/subject.entity";
import { MockExamEntity } from "./mock-exam.entity";

/**
 * Persists the result of a student's mock exam submission.
 * Created by MockController.submitMockExam() so admin can view student results.
 */
@Entity("mock_exam_results")
@Index("IDX_mock_exam_results_exam_id",    ["examId"])
@Index("IDX_mock_exam_results_account_id", ["accountId"])
@Index("IDX_mock_exam_results_subject_id", ["subjectId"])
export class MockExamResultEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "exam_id" })
  examId: string;

  @Column({ name: "account_id" })
  accountId: string;

  @Column({ name: "subject_id" })
  subjectId: string;

  /** The exam session UUID returned to the student at start */
  @Column({ name: "session_id" })
  sessionId: string;

  @Column({ name: "total_questions", type: "int" })
  totalQuestions: number;

  @Column({ name: "correct_answers", type: "int" })
  correctAnswers: number;

  @Column({ name: "score_percent", type: "int" })
  scorePercent: number;

  @Column({ name: "passed" })
  passed: boolean;

  @CreateDateColumn({ type: "timestamptz", name: "taken_at" })
  takenAt: Date;

  @ManyToOne(() => MockExamEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "exam_id" })
  exam: MockExamEntity;

  @ManyToOne(() => AccountEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account: AccountEntity;

  @ManyToOne(() => SubjectEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "subject_id" })
  subject: SubjectEntity;
}
