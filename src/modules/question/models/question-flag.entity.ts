import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { AccountEntity } from "../../account/models/accounts/account.entity";
import { QuestionEntity } from "./questions/question.entity";

export type FlagStatus = "pending" | "reviewed" | "resolved" | "dismissed";

@Entity("question_flags")
@Unique("UQ_question_flags_account_question", ["accountId", "questionId"])
export class QuestionFlagEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "account_id" })
  accountId: string;

  @Index("IDX_question_flags_question_id")
  @Column({ name: "question_id" })
  questionId: string;

  @Column({ length: 500 })
  reason: string;

  @Index("IDX_question_flags_status")
  @Column({ length: 20, default: "pending" })
  status: FlagStatus;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => AccountEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account: AccountEntity;

  @ManyToOne(() => QuestionEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "question_id" })
  question: QuestionEntity;
}
