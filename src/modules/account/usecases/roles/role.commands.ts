import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { RoleEntity } from "@account/models/roles/role.entity";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class CreateRoleCommand {
  @ApiProperty({ example: "Admin" })
  @IsNotEmpty()
  name: string;
  @ApiProperty({ example: "admin" })
  @IsNotEmpty()
  key: string;
  protected: boolean;
  currentUser: UserInfo;
  static fromCommand(command: CreateRoleCommand): RoleEntity {
    const roleDomain = new RoleEntity();
    roleDomain.name = command.name;
    roleDomain.name = command.key;
    roleDomain.protected = command.protected;
    return roleDomain;
  }
}

export class UpdateRoleCommand {
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  id: string;
  @ApiProperty({ example: "Admin" })
  @IsNotEmpty()
  name: string;
  @ApiProperty({ example: "admin" })
  @IsNotEmpty()
  key: string;
  currentUser: UserInfo;
}
export class ArchiveRoleCommand {
  @ApiProperty({
    example: "d02dd06f-2a30-4ed8-a2a0-75c683e3092e",
  })
  @IsNotEmpty()
  id: string;
  @ApiProperty({ example: "Deprecated role" })
  @IsNotEmpty()
  reason: string;
  currentUser: UserInfo;
}
