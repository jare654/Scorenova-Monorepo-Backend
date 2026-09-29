import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { SubjectEntity } from "../../subject/models/subjects/subject.entity";

export interface MockExamQuestion {
  question: string;
  choices: string[];   // ["A) ...", "B) ...", "C) ...", "D) ..."]
  answer: string;      // "A" | "B" | "C" | "D"
  explanation: string;
}

export enum MockExamStatus {
  Pending   = "pending",
  Completed = "completed",
  Failed    = "failed",
}

@Entity("mock_exams")
@Index("IDX_mock_exams_subject_id", ["subjectId"])
export class MockExamEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "subject_id" })
  subjectId: string;

  @Column({ name: "topic_id", type: "uuid", nullable: true })
  topicId: string | null;

  /** e.g. "Mock Exam 1", "Mock Exam 2" */
  @Column({ name: "label", length: 100 })
  label: string;

  /** Number of questions requested by admin */
  @Column({ name: "question_count", type: "int" })
  questionCount: number;

  /** Duration of exam in minutes */
  @Column({ name: "duration_minutes", type: "int", nullable: true })
  durationMinutes: number | null;

  /** AI-generated questions stored as JSONB */
  @Column({ name: "questions", type: "jsonb", default: [] })
  questions: MockExamQuestion[];

  /** Generation status */
  @Column({
    name: "status",
    type: "varchar",
    length: 20,
    default: MockExamStatus.Pending,
  })
  status: MockExamStatus;

  /** Error message if generation failed */
  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage: string | null;

  @Column({ name: "is_free", type: "boolean", default: false })
  isFree: boolean;

  @Column({ name: "access_type", type: "varchar", length: 20, default: "paid" })
  accessType: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => SubjectEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "subject_id" })
  subject: SubjectEntity;
}
