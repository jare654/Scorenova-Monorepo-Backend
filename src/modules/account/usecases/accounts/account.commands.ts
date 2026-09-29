import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { Address } from "@libs/common/address";
import { AccountEntity } from "@account/models/accounts/account.entity";
import { AccountRegistrationStatus } from "@account/models/accounts/account.entity";

export class CreateAccountCommand {
  @ApiProperty({ example: "Abebe Bikila" })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "abebe@example.com" })
  email: string;

  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: "student" })
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"] })
  @IsNotEmpty()
  role?: string[];

  @ApiProperty({ example: "Password123!" })
  @IsNotEmpty()
  password: string | null;

  @ApiProperty({ example: "male" })
  gender?: string;

  @ApiProperty()
  address?: Address;

  @ApiProperty({ example: "avatar_123.jpg" })
  profileImageFilename?: string;

  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  gradeId?: string;

  @ApiProperty({ required: false, description: "Stream ID (Natural Science or Social Science)", example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22" })
  streamId?: string;

  @ApiProperty({ example: false })
  isPremium?: boolean;

  accountId: string;
  isActive: boolean;
  isIntegration?: boolean;
  canLogin?: boolean;
  passwordHash?: string;
  otpVerified?: boolean;
  status?: AccountRegistrationStatus;

  static fromCommand(command: CreateAccountCommand): AccountEntity {
    const accountDomain = new AccountEntity();
    accountDomain.name = command.name;
    accountDomain.email = command.email?.toLowerCase() ?? "";
    accountDomain.phoneNumber = command.phoneNumber;
    accountDomain.id = command.accountId;
    accountDomain.type = command.type.toLowerCase();
    accountDomain.isActive = command.isActive;
    accountDomain.password = command.password;
    accountDomain.gender = command.gender;
    accountDomain.address = command.address;
    accountDomain.profileImageFilename = command.profileImageFilename;
    accountDomain.gradeId = command.gradeId;
    (accountDomain as any).streamId = command.streamId ?? null;
    accountDomain.isPremium = command.isPremium ?? false;
    accountDomain.username = `${command.type.toLowerCase()}_${command.phoneNumber.toLowerCase()}`;
    accountDomain.otpVerified = command.otpVerified ?? false;
    accountDomain.status = command.status ?? (command.password ? "active" : "pending_otp");
    return accountDomain;
  }
}

export class UpdateAccountCommand {
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  accountId: string;

  @ApiProperty({ example: "Abebe Bikila" })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "admin@scorenova.et" })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: "male" })
  gender?: string;

  @ApiProperty()
  address?: Address;

  @ApiProperty({ example: "avatar_123.jpg" })
  profileImageFilename?: string;

  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  gradeId?: string;

  @ApiProperty({ required: false, example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22" })
  streamId?: string;

  @ApiProperty({ example: false })
  isPremium?: boolean;
}

export class CreateAdminCommand {
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: "phoneNumber must contain digits only" })
  @MaxLength(15)
  phoneNumber: string;

  @ApiProperty({ example: "AdminPassword123!" })
  @IsNotEmpty()
  @MaxLength(25)
  password: string;

  @ApiProperty({ example: "System Administrator" })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false, example: "admin@scorenova.et" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, isArray: true, example: ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"] })
  @IsOptional()
  @IsArray()
  roleIds?: string[];

  @ApiProperty({ required: false, isArray: true, example: ["c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"] })
  @IsOptional()
  @IsArray()
  permissionIds?: string[];

  @ApiProperty({ required: false, description: "Role to attach permissions to", example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsOptional()
  permissionRoleId?: string;
}
