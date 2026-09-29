import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("streams")
export class StreamEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("UQ_streams_name", { unique: true })
  @Column({ length: 100 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;
}
