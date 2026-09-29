import { AccountEntity } from "@account/models/accounts/account.entity";
import { Address } from "@libs/common/address";
import { ApiProperty } from "@nestjs/swagger";

export class AccountResponse {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  phoneNumber: string;
  @ApiProperty()
  email: string;
  @ApiProperty()
  type: string;
  @ApiProperty()
  isActive: boolean;
  @ApiProperty()
  gender?: string;
  @ApiProperty()
  address?: Address;
  @ApiProperty()
  profileImageFilename?: string;
  @ApiProperty()
  fcmId?: string;
  @ApiProperty()
  gradeId?: string;
  @ApiProperty()
  streamId?: string | null;
  @ApiProperty()
  isPremium?: boolean;
  @ApiProperty()
  premiumStartDate?: Date | null;
  @ApiProperty()
  premiumEndDate?: Date | null;
  @ApiProperty()
  premiumPlan?: string | null;
  @ApiProperty()
  studyGoals?: {
    dailyTarget?: number;
    weeklyTarget?: number;
    accuracyTarget?: number;
  } | null;
  @ApiProperty()
  createdBy?: string;
  @ApiProperty()
  updatedBy?: string;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
  @ApiProperty()
  deletedAt?: Date;
  @ApiProperty()
  deletedBy?: string;
  static fromEntity(accountEntity: AccountEntity): AccountResponse {
    const accountResponse = new AccountResponse();
    accountResponse.id = accountEntity.id;
    accountResponse.name = accountEntity.name;
    accountResponse.email = accountEntity.email;
    accountResponse.phoneNumber = accountEntity.phoneNumber;
    accountResponse.type = accountEntity.type;
    accountResponse.isActive = accountEntity.isActive;
    accountResponse.gender = accountEntity.gender;
    accountResponse.address = accountEntity.address;
    accountResponse.profileImageFilename = accountEntity.profileImageFilename;
    accountResponse.fcmId = accountEntity.fcmId;
    accountResponse.gradeId = accountEntity.gradeId;
    accountResponse.streamId = accountEntity.streamId ?? null;
    accountResponse.isPremium = accountEntity.isPremium;
    accountResponse.premiumStartDate = accountEntity.premiumStartDate ?? null;
    accountResponse.premiumEndDate = accountEntity.premiumEndDate ?? null;
    accountResponse.premiumPlan = accountEntity.premiumPlan ?? null;
    accountResponse.studyGoals = (accountEntity as any).studyGoals ?? null;
    accountResponse.createdBy = accountEntity.createdBy;
    accountResponse.updatedBy = accountEntity.updatedBy;
    accountResponse.deletedBy = accountEntity.deletedBy;
    accountResponse.createdAt = accountEntity.createdAt;
    accountResponse.updatedAt = accountEntity.updatedAt;
    accountResponse.deletedAt = accountEntity.deletedAt;
    return accountResponse;
  }
}
