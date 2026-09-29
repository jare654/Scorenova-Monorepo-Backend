import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { AccountRoleEntity } from "@account/models/accounts/account-role.entity";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
export class CreateAccountRoleCommand {
  accountId: string;
  roleId: string;
  currentUser?: UserInfo;
  static fromCommand(
    createAccountRole: CreateAccountRoleCommand
  ): AccountRoleEntity {
    const accountRole = new AccountRoleEntity();
    accountRole.accountId = createAccountRole.accountId;
    accountRole.roleId = createAccountRole.roleId;
    return accountRole;
  }
}
export class CreateAccountRolesCommand {
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  accountId: string;
  @ApiProperty({ example: ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"] })
  @IsNotEmpty()
  roles: string[];
  currentUser?: UserInfo;
}
export class UpdateAccountRoleCommand {
  @ApiProperty({ example: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33" })
  @IsNotEmpty()
  id: string;
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  accountId: string;
  @ApiProperty({ example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22" })
  @IsNotEmpty()
  roleId: string;
  currentUser: UserInfo;
  static fromCommand(
    updateAccountRole: UpdateAccountRoleCommand
  ): AccountRoleEntity {
    const accountRole = new AccountRoleEntity();
    accountRole.id = updateAccountRole.id;
    accountRole.accountId = updateAccountRole.accountId;
    accountRole.roleId = updateAccountRole.roleId;
    return accountRole;
  }
}
export class DeleteAccountRoleCommand {
  @ApiProperty({ example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22" })
  @IsNotEmpty()
  roleId: string;
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  accountId: string;
  currentUser: UserInfo;
}
export class ArchiveAccountRoleCommand {
  @ApiProperty({ example: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33" })
  @IsNotEmpty()
  id: string;
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  accountId: string;
  @ApiProperty({ example: "Role unassigned" })
  @IsNotEmpty()
  reason: string;
  currentUser: UserInfo;
}
