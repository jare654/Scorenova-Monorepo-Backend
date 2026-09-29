import { RolePermissionEntity } from "@account/models/roles/role-permission.entity";
import { ApiProperty } from "@nestjs/swagger";
import { PermissionResponse } from "../permissions/permission.response";
import { RoleResponse } from "./role.response";

export class RolePermissionResponse {
  @ApiProperty()
  id: string;
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
  role: RoleResponse;
  permission: PermissionResponse;
  static fromEntity(
    rolePermissionEntity: RolePermissionEntity
  ): RolePermissionResponse {
    const rolePermissionResponse = new RolePermissionResponse();
    rolePermissionResponse.id = rolePermissionEntity.id;
    rolePermissionResponse.permissionId = rolePermissionEntity.permissionId;
    rolePermissionResponse.roleId = rolePermissionEntity.roleId;
    rolePermissionResponse.archiveReason = rolePermissionEntity.archiveReason;
    rolePermissionResponse.createdBy = rolePermissionEntity.createdBy;
    rolePermissionResponse.updatedBy = rolePermissionEntity.updatedBy;
    rolePermissionResponse.deletedBy = rolePermissionEntity.deletedBy;
    rolePermissionResponse.createdAt = rolePermissionEntity.createdAt;
    rolePermissionResponse.updatedAt = rolePermissionEntity.updatedAt;
    rolePermissionResponse.deletedAt = rolePermissionEntity.deletedAt;
    if (rolePermissionEntity.role) {
      rolePermissionResponse.role = RoleResponse.fromEntity(
        rolePermissionEntity.role
      );
    }
    if (rolePermissionEntity.permission) {
      rolePermissionResponse.permission = PermissionResponse.fromEntity(
        rolePermissionEntity.permission
      );
    }
    return rolePermissionResponse;
  }
}
