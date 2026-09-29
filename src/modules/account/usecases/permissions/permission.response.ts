import { PermissionEntity } from "@account/models/permissions/permission.entity";
import { ApiProperty } from "@nestjs/swagger";

export class PermissionResponse {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  key: string;
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
  static fromEntity(permissionEntity: PermissionEntity): PermissionResponse {
    const permissionResponse = new PermissionResponse();
    permissionResponse.id = permissionEntity.id;
    permissionResponse.name = permissionEntity.name;
    permissionResponse.key = permissionEntity.key;
    permissionResponse.createdBy = permissionEntity.createdBy;
    permissionResponse.updatedBy = permissionEntity.updatedBy;
    permissionResponse.deletedBy = permissionEntity.deletedBy;
    permissionResponse.createdAt = permissionEntity.createdAt;
    permissionResponse.updatedAt = permissionEntity.updatedAt;
    permissionResponse.deletedAt = permissionEntity.deletedAt;
    return permissionResponse;
  }
}
