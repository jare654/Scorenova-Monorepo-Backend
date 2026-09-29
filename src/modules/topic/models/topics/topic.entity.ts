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
import { SubjectEntity } from "../../../subject/models/subjects/subject.entity";

@Entity("topics")
@Index("UQ_topics_subject_id_name", ["subjectId", "name"], { unique: true })
export class TopicEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("IDX_topics_subject_id")
  @Column({ name: "subject_id" })
  subjectId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ name: "duration_minutes", type: "int", nullable: true })
  durationMinutes: number | null;

  @Column({ name: "is_free", type: "boolean", default: false })
  isFree: boolean;

  @Column({ name: "access_type", type: "varchar", length: 20, default: "paid" })
  accessType: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => SubjectEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "subject_id" })
  subject: SubjectEntity;
}
