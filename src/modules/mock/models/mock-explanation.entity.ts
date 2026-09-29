import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { MockExamEntity } from "./mock-exam.entity";

@Entity("mock_question_explanations")
@Index("UQ_mock_explanation_exam_idx", ["examId", "questionIndex"], { unique: true })
export class MockExplanationEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("IDX_mock_explanation_exam_id")
  @Column({ name: "exam_id" })
  examId: string;

  @Column({ name: "question_index", type: "int" })
  questionIndex: number;

  @Column({ name: "step_by_step", type: "text" })
  stepByStep: string;

  @Column({ type: "text" })
  clear: string;

  @Column({ type: "text" })
  simplified: string;

  @Column({ name: "usage_count", type: "int", default: 0 })
  usageCount: number;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => MockExamEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "exam_id" })
  exam: MockExamEntity;
}
