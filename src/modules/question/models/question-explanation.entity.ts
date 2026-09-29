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
import { QuestionEntity } from "./questions/question.entity";

@Entity("question_explanations")
export class QuestionExplanationEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("UQ_question_explanations_question_id", { unique: true })
  @Column({ name: "question_id" })
  questionId: string;

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

  @ManyToOne(() => QuestionEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "question_id" })
  question: QuestionEntity;
}
