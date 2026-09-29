import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { PermissionEntity } from "@account/models/permissions/permission.entity";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class CreatePermissionCommand {
  @ApiProperty({ example: "Manage Questions" })
  @IsNotEmpty()
  name: string;
  @ApiProperty({ example: "manage_questions" })
  @IsNotEmpty()
  key: string;
  currentUser: UserInfo;
  static fromCommand(command: CreatePermissionCommand): PermissionEntity {
    const permissionDomain = new PermissionEntity();
    permissionDomain.name = command.name;
    permissionDomain.key = command.key;
    return permissionDomain;
  }
}

export class UpdatePermissionCommand {
  @ApiProperty({ example: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33" })
  @IsNotEmpty()
  id: string;
  @ApiProperty({ example: "Manage Questions" })
  @IsNotEmpty()
  name: string;
  @ApiProperty({ example: "manage_questions" })
  @IsNotEmpty()
  key: string;
  currentUser: UserInfo;
}
export class ArchivePermissionCommand {
  @ApiProperty({
    example: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
  })
  @IsNotEmpty()
  id: string;
  @ApiProperty({ example: "Permission deprecated" })
  @IsNotEmpty()
  reason: string;
  currentUser: UserInfo;
}
