import { Address } from "@libs/common/address";
import { CommonEntity } from "@libs/common/entities/common.entity";
import { Column, Entity, Index, OneToMany, PrimaryColumn } from "typeorm";
import { AccountPermissionEntity } from "./account-permission.entity";
import { AccountRoleEntity } from "./account-role.entity";

export type AccountRegistrationStatus =
  | "pending_otp"
  | "pending_details"
  | "pending_password"
  | "active";

@Entity("accounts")
export class AccountEntity extends CommonEntity {
  @PrimaryColumn("uuid")
  id: string;
  @Column()
  name: string;
  @Index()
  @Column({ name: "phone_number" })
  phoneNumber: string;
  @Column({ nullable: true })
  email: string;
  @Column()
  type: string;
  @Column({ nullable: true })
  gender: string;
  @Index()
  @Column({ nullable: true })
  username: string;
  @Column({ name: "is_active" })
  isActive: boolean;
  @Column({ nullable: true })
  password: string | null;
  @Index()
  @Column({ name: "status", type: "varchar", length: 32, default: "pending_otp" })
  status: AccountRegistrationStatus;
  @Column({ nullable: true, name: "fcm_id" })
  fcmId: string;
  @Column({ name: "address", type: "jsonb", nullable: true })
  address: Address;
  @Index()
  @Column({ name: "grade_id", type: "uuid", nullable: true })
  gradeId: string;

  @Index()
  @Column({ name: "stream_id", type: "uuid", nullable: true })
  streamId: string | null;
  @Column({ name: "is_premium", default: false })
  isPremium: boolean;
  @Column({ name: "premium_start_date", type: "timestamptz", nullable: true })
  premiumStartDate: Date | null;
  @Column({ name: "premium_end_date", type: "timestamptz", nullable: true })
  premiumEndDate: Date | null;
  @Column({ name: "premium_plan", type: "varchar", length: 50, nullable: true })
  premiumPlan: string | null;
  @Column({ name: "profile_image_filename", nullable: true })
  profileImageFilename: string;
  @Column({ name: "study_goals", type: "jsonb", nullable: true })
  studyGoals: {
    dailyTarget?: number;
    weeklyTarget?: number;
    accuracyTarget?: number;
  } | null;
  @Column({ default: false })
  isIntegration: boolean;
  @Column({ name: "otp_verified", default: false })
  otpVerified: boolean;
  @OneToMany(() => AccountRoleEntity, (accountRole) => accountRole.account, {
    cascade: true,
    onDelete: "CASCADE",
  })
  public accountRoles: AccountRoleEntity[];
  @OneToMany(
    () => AccountPermissionEntity,
    (accountPermission) => accountPermission.account,
    {
      cascade: true,
      onDelete: "CASCADE",
    }
  )
  public accountPermissions: AccountPermissionEntity[];

  async addAccountRole(accountRole: AccountRoleEntity) {
    this.accountRoles.push(accountRole);
  }
  async updateAccountRole(accountRole: AccountRoleEntity) {
    const existIndex = this.accountRoles.findIndex(
      (element) => element.id == accountRole.id
    );
    this.accountRoles[existIndex] = accountRole;
  }
  async removeAccountRole(id: string) {
    this.accountRoles = this.accountRoles.filter((element) => element.id != id);
  }
  async updateAccountRoles(accountRoles: AccountRoleEntity[]) {
    this.accountRoles = accountRoles;
  }

  async addAccountPermission(accountPermission: AccountPermissionEntity) {
    this.accountPermissions.push(accountPermission);
  }
  async updateAccountPermission(accountPermission: AccountPermissionEntity) {
    const existIndex = this.accountPermissions.findIndex(
      (element) => element.id == accountPermission.id
    );
    this.accountPermissions[existIndex] = accountPermission;
  }
  async removeAccountPermission(id: string) {
    this.accountPermissions = this.accountPermissions.filter(
      (element) => element.id != id
    );
  }
  async updateAccountPermissions(
    accountPermissions: AccountPermissionEntity[]
  ) {
    this.accountPermissions = accountPermissions;
  }
}
