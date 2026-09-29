import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

/**
 * NOTE: stream_id is stored as a plain UUID column without a FK constraint.
 * This is intentional — the production DB may have subjects with stream_id values
 * before the streams table is fully populated. The FK relation is enforced at the
 * application layer (ExplanationService, SubjectCommands) rather than the DB layer.
 * Once the streams table is stable on production, the FK can be re-added via migration.
 */
@Entity("subjects")
@Index("UQ_subjects_stream_id_name", ["streamId", "name"], { unique: true })
export class SubjectEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Plain UUID — no FK constraint to avoid synchronize failures when streams
  // table doesn't exist yet on the target DB.
  @Index("IDX_subjects_stream_id")
  @Column({ name: "stream_id", type: "uuid", nullable: true })
  streamId: string | null;

  // Kept nullable for backward compat with existing rows that have grade_id set.
  @Index("IDX_subjects_grade_id")
  @Column({ name: "grade_id", type: "uuid", nullable: true })
  gradeId: string | null;

  @Column({ length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ name: "is_free", type: "boolean", default: false })
  isFree: boolean;

  @Column({ name: "access_type", type: "varchar", length: 20, default: "paid" })
  accessType: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;
}
