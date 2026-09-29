import { BaseEntity } from "@libs/common/entities/base.entity";
import { Column, Entity, Index } from "typeorm";

@Entity("settings")
@Index(["section"], { unique: true })
export class SettingsEntity extends BaseEntity {
  @Column({ type: "varchar", length: 100 })
  section: string;

  @Column({ type: "jsonb", default: {} })
  data: Record<string, any>;
}
