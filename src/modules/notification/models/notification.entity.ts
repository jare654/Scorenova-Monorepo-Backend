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

@Entity("notifications")
export class NotificationEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "account_id" })
  accountId: string;

  @Column()
  title: string;

  @Column({ type: "text" })
  body: string;

  @Column({ default: false, name: "is_read" })
  isRead: boolean;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => AccountEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account: AccountEntity;
}
