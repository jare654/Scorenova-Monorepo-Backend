import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { AccountEntity } from "../../account/models/accounts/account.entity";
import { QuestionEntity } from "./questions/question.entity";

@Entity("saved_questions")
@Unique("UQ_saved_questions_account_question", ["accountId", "questionId"])
export class SavedQuestionEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("IDX_saved_questions_account_id")
  @Column({ name: "account_id" })
  accountId: string;

  @Column({ name: "question_id" })
  questionId: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => AccountEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account: AccountEntity;

  @ManyToOne(() => QuestionEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "question_id" })
  question: QuestionEntity;
}
