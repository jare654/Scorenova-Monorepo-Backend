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
import { TopicEntity } from "../../../topic/models/topics/topic.entity";

export enum QuestionDifficulty {
  Easy = "easy",
  Medium = "medium",
  Hard = "hard",
}

@Entity("questions")
@Index(["subjectId", "topicId"])
@Index(["subjectId", "difficulty"])
@Index(["topicId", "difficulty"])
export class QuestionEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "subject_id" })
  subjectId: string;

  @Index()
  @Column({ name: "topic_id", nullable: true })
  topicId: string | null;

  @Column({ type: "text" })
  text: string;

  @Column({ type: "jsonb", nullable: true })
  options: string[] | null;

  @Column({ name: "correct_answer", type: "text" })
  correctAnswer: string;

  @Column({
    type: "enum",
    enum: QuestionDifficulty,
    default: QuestionDifficulty.Medium,
  })
  difficulty: QuestionDifficulty;

  @Column({ type: "text", nullable: true })
  explanation: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => SubjectEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "subject_id" })
  subject: SubjectEntity;

  @ManyToOne(() => TopicEntity, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "topic_id" })
  topic: TopicEntity | null;
}
