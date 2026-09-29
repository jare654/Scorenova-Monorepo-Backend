import { AccountPermissionEntity } from "@account/models/accounts/account-permission.entity";
import { ApiProperty } from "@nestjs/swagger";
import { PermissionResponse } from "../permissions/permission.response";
import { RoleResponse } from "../roles/role.response";
import { AccountResponse } from "./account.response";

export class AccountPermissionResponse {
  @ApiProperty()
  id: string;
  @ApiProperty()
  accountId: string;
  @ApiProperty()
  permissionId: string;
  @ApiProperty()
  roleId: string;
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
  @ApiProperty()
  archiveReason: string;
  permission: PermissionResponse;
  role: RoleResponse;
  account: AccountResponse;
  static fromEntity(
    accountPermissionEntity: AccountPermissionEntity
  ): AccountPermissionResponse {
    const accountPermissionResponse = new AccountPermissionResponse();
    accountPermissionResponse.id = accountPermissionEntity.id;
    accountPermissionResponse.accountId = accountPermissionEntity.accountId;
    accountPermissionResponse.permissionId =
      accountPermissionEntity.permissionId;
    accountPermissionResponse.roleId = accountPermissionEntity.roleId;
    accountPermissionResponse.archiveReason =
      accountPermissionEntity.archiveReason;
    accountPermissionResponse.createdBy = accountPermissionEntity.createdBy;
    accountPermissionResponse.updatedBy = accountPermissionEntity.updatedBy;
    accountPermissionResponse.deletedBy = accountPermissionEntity.deletedBy;
    accountPermissionResponse.createdAt = accountPermissionEntity.createdAt;
    accountPermissionResponse.updatedAt = accountPermissionEntity.updatedAt;
    accountPermissionResponse.deletedAt = accountPermissionEntity.deletedAt;
    if (accountPermissionEntity.permission) {
      accountPermissionResponse.permission = PermissionResponse.fromEntity(
        accountPermissionEntity.permission
      );
    }
    if (accountPermissionEntity.role) {
      accountPermissionResponse.role = RoleResponse.fromEntity(
        accountPermissionEntity.role
      );
    }
    if (accountPermissionEntity.account) {
      accountPermissionResponse.account = AccountResponse.fromEntity(
        accountPermissionEntity.account
      );
    }
    return accountPermissionResponse;
  }
}
