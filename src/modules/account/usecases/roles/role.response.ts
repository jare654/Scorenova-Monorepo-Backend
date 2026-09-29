import { RoleEntity } from "@account/models/roles/role.entity";
import { ApiProperty } from "@nestjs/swagger";

export class RoleResponse {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  key: string;
  @ApiProperty()
  protected: boolean;
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
  static fromEntity(roleEntity: RoleEntity): RoleResponse {
    const roleResponse = new RoleResponse();
    roleResponse.id = roleEntity.id;
    roleResponse.name = roleEntity.name;
    roleResponse.key = roleEntity.key;
    roleResponse.protected = roleEntity.protected;
    roleResponse.createdBy = roleEntity.createdBy;
    roleResponse.updatedBy = roleEntity.updatedBy;
    roleResponse.deletedBy = roleEntity.deletedBy;
    roleResponse.createdAt = roleEntity.createdAt;
    roleResponse.updatedAt = roleEntity.updatedAt;
    roleResponse.deletedAt = roleEntity.deletedAt;
    return roleResponse;
  }
}
