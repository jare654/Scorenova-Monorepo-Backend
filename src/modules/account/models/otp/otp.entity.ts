import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("otps")
export class OtpEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "phone_number" })
  phoneNumber: string;

  @Column({ length: 6 })
  otp: string;

  @Column({ name: "verification_id", nullable: true })
  verificationId: string | null;

  /** Internal: 'registration' | 'forgot_password' – not in API schema */
  @Column({ name: "flow_type", nullable: true })
  flowType: string | null;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @Column({ name: "verified", default: false })
  verified: boolean;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;
}
