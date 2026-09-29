import { BaseEntity } from "@libs/common/entities/base.entity";
import { Column, Entity } from "typeorm";
@Entity("reset_password_tokens")
export class ResetPasswordTokenEntity extends BaseEntity {
  @Column({ type: "text" })
  token: string;
  @Column()
  email: string;
  @Column({ name: "account_id", type: "uuid", nullable: true })
  accountId: string;
  @Column()
  type: string;
}
