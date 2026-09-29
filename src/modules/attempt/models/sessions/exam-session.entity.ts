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

@Entity("exam_sessions")
@Index("IDX_exam_sessions_account_id", ["accountId"])
@Index("IDX_exam_sessions_subject_id", ["subjectId"])
export class ExamSessionEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "account_id" })
  accountId: string;

  @Column({ name: "subject_id" })
  subjectId: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => AccountEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account: AccountEntity;

  @ManyToOne(() => SubjectEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "subject_id" })
  subject: SubjectEntity;
}
