import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Address } from "@libs/common/address";

export class RoleInfoDto {
  @ApiProperty({ example: "role_123" })
  id: string;

  @ApiProperty({ example: "Admin" })
  name: string;

  @ApiProperty({ example: "admin" })
  key: string;
}

export type RoleInfo = RoleInfoDto;

export class UserInfoDto {
  @ApiProperty({ example: "acc_123456" })
  id: string;

  @ApiPropertyOptional({ example: "user@example.com" })
  email?: string;

  @ApiProperty({ example: "John Doe" })
  name: string;

  @ApiProperty({ type: () => RoleInfoDto })
  role: RoleInfoDto;

  @ApiPropertyOptional({ example: ["read:users", "write:users"], type: [String] })
  permissions?: string[];

  @ApiPropertyOptional({ example: "male" })
  gender?: string;

  @ApiProperty({ example: "Student" })
  type: string;

  @ApiPropertyOptional({ example: "uuid-grade-id", nullable: true })
  gradeId?: string | null;

  @ApiPropertyOptional({ example: "uuid-stream-id", nullable: true })
  streamId?: string | null;

  @ApiPropertyOptional({ example: "fcm_token_xyz" })
  fcmId?: string;

  @ApiPropertyOptional({ example: "avatar.png" })
  profileImageFilename?: string;

  @ApiPropertyOptional({ type: () => Address })
  address?: Address;

  @ApiPropertyOptional({ example: "0912345678" })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: true })
  isPremium?: boolean;

  @ApiPropertyOptional({ example: "2026-12-31T23:59:59.000Z", nullable: true })
  premiumEndDate?: string | null;
}

export type UserInfo = UserInfoDto;
