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
import { AccountEntity } from "../../account/models/accounts/account.entity";

export type ReportType =
  | "sign_up_problems"
  | "upload_scan_failed"
  | "app_crashes"
  | "wrong_answer"
  | "subscription_issue"
  | "other"
  | "bug"           // legacy
  | "question_issue" // legacy
  | "content";       // legacy
export type ReportStatus = "open" | "in_progress" | "resolved" | "closed";

@Entity("user_reports")
export class UserReportEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "account_id" })
  accountId: string;

  @Index("IDX_user_reports_type")
  @Column({ length: 50, default: "other" })
  type: ReportType;

  @Column({ type: "text" })
  description: string;

  @Column({ name: "question_id", type: "uuid", nullable: true })
  questionId: string | null;

  @Column({ name: "screenshot_url", type: "text", nullable: true })
  screenshotUrl: string | null;

  @Index("IDX_user_reports_status")
  @Column({ length: 20, default: "open" })
  status: ReportStatus;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => AccountEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account: AccountEntity;
}
