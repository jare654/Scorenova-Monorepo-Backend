import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("grades")
export class GradeEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("UQ_grades_name", { unique: true })
  @Column({ length: 20 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;
}
