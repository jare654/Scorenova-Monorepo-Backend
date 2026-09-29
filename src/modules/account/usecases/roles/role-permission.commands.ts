import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { RolePermissionEntity } from "@account/models/roles/role-permission.entity";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
export class CreateRolePermissionCommand {
  permissionId: string;
  roleId: string;
  currentUser?: UserInfo;
  static fromCommand(
    createRolePermission: CreateRolePermissionCommand
  ): RolePermissionEntity {
    const accountRole = new RolePermissionEntity();
    accountRole.permissionId = createRolePermission.permissionId;
    accountRole.roleId = createRolePermission.roleId;
    return accountRole;
  }
}
export class CreateRolePermissionsCommand {
  @ApiProperty({ example: ["c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"] })
  @IsNotEmpty()
  permissions: string[];
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  roleId: string;
  currentUser: UserInfo;
}
export class UpdateRolePermissionCommand {
  @ApiProperty({ example: "d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44" })
  @IsNotEmpty()
  id: string;
  @ApiProperty({ example: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33" })
  @IsNotEmpty()
  permissionId: string;
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  roleId: string;
  currentUser: UserInfo;
  static fromCommand(
    updateRolePermission: UpdateRolePermissionCommand
  ): RolePermissionEntity {
    const accountRole = new RolePermissionEntity();
    accountRole.id = updateRolePermission.id;
    accountRole.permissionId = updateRolePermission.permissionId;
    accountRole.roleId = updateRolePermission.roleId;
    return accountRole;
  }
}
export class DeleteRolePermissionCommand {
  @ApiProperty({ example: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33" })
  @IsNotEmpty()
  permissionId: string;
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  roleId: string;
  currentUser: UserInfo;
}
export class ArchiveRolePermissionCommand {
  @ApiProperty({ example: "d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44" })
  @IsNotEmpty()
  id: string;
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  roleId: string;
  @ApiProperty({ example: "Permission revoked" })
  @IsNotEmpty()
  reason: string;
  currentUser: UserInfo;
}
