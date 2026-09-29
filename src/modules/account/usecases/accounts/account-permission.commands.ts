import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { AccountPermissionEntity } from "@account/models/accounts/account-permission.entity";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
export class AddAccountPermissionsCommand {
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  accountId: string;
  @ApiProperty({ example: ["c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"] })
  @IsNotEmpty()
  permissions: string[];
  @ApiProperty({ example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22" })
  @IsNotEmpty()
  roleId: string;
  currentUser: UserInfo;
}
export class CreateAccountPermissionCommand {
  accountId: string;
  permissionId: string;
  roleId: string;
  static fromCommand(
    createAccountPermission: CreateAccountPermissionCommand
  ): AccountPermissionEntity {
    const accountPermission = new AccountPermissionEntity();
    accountPermission.accountId = createAccountPermission.accountId;
    accountPermission.permissionId = createAccountPermission.permissionId;
    accountPermission.roleId = createAccountPermission.roleId;
    return accountPermission;
  }
}
export class UpdateAccountPermissionCommand {
  @ApiProperty({ example: "d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44" })
  @IsNotEmpty()
  id: string;
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  accountId: string;
  @ApiProperty({ example: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33" })
  @IsNotEmpty()
  permissionId: string;
  @ApiProperty({ example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22" })
  @IsNotEmpty()
  roleId: string;
  currentUser: UserInfo;
  static fromCommand(
    updateAccountPermission: UpdateAccountPermissionCommand
  ): AccountPermissionEntity {
    const accountPermission = new AccountPermissionEntity();
    accountPermission.id = updateAccountPermission.id;
    accountPermission.accountId = updateAccountPermission.accountId;
    accountPermission.permissionId = updateAccountPermission.permissionId;
    accountPermission.roleId = updateAccountPermission.roleId;
    return accountPermission;
  }
}
export class DeleteAccountPermissionCommand {
  @ApiProperty({ example: "d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44" })
  @IsNotEmpty()
  id: string;
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  accountId: string;
  @ApiProperty({ example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22" })
  @IsNotEmpty()
  roleId: string;
  @ApiProperty({ example: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33" })
  @IsNotEmpty()
  permissionId: string;
  currentUser: UserInfo;
}
export class ArchiveAccountPermissionCommand {
  @ApiProperty({ example: "d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44" })
  @IsNotEmpty()
  id: string;
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  accountId: string;
  @ApiProperty({ example: "Account permission unassigned" })
  @IsNotEmpty()
  reason: string;
  currentUser: UserInfo;
}
