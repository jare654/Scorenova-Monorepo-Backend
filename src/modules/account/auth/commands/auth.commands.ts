import { UserInfo } from "../dtos/user-info.dto";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { Match } from "../decorators/match.decorator";

const PHONE_DIGITS = /^\d+$/;
const OTP_LENGTH = 6;

export class UserLoginCommand {
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @Matches(PHONE_DIGITS, { message: "phoneNumber must contain digits only" })
  @MaxLength(15)
  phoneNumber: string;
  @ApiProperty({ example: "Password123!" })
  @IsNotEmpty()
  @MaxLength(25)
  password: string;
  @ApiProperty({ example: "student" })
  type: string;
  fcmId: string;
}

export class LoginDto {
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @MaxLength(15)
  phoneNumber: string;
  @ApiProperty({ example: "Password123!" })
  @IsNotEmpty()
  @MinLength(6, { message: "password must be at least 6 characters" })
  @MaxLength(64, { message: "password must not exceed 64 characters" })
  password: string;
  @ApiProperty({ enum: ["admin", "customer", "student"], example: "student" })
  @IsIn(["admin", "customer", "student"], {
    message: "loginAs must be 'admin', 'student', or 'customer'",
  })
  loginAs: "admin" | "customer" | "student";
  @ApiProperty({ required: false, example: "fcm_token_sample_xyz123" })
  @IsOptional()
  fcmId?: string;
}

export class RegisterStepOneDto {
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @MaxLength(15)
  phoneNumber: string;
  @ApiProperty({ example: "Abebe Bikila" })
  @IsNotEmpty()
  @MinLength(1)
  fullName: string;
  @ApiProperty({ required: false, example: "abebe@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string;
  @ApiProperty({ required: false, example: "student" })
  @IsOptional()
  userType?: string;
  @ApiProperty({ required: false, example: "male" })
  @IsOptional()
  gender?: string;
  @ApiProperty({ required: false, example: "2002-05-15" })
  @IsOptional()
  birthday?: string;
  @ApiProperty({ required: false, example: "Addis Ababa" })
  @IsOptional()
  city?: string;
  @ApiProperty({ required: false, example: "Bole Sub City, Woreda 03" })
  @IsOptional()
  address?: string;
  @ApiProperty({ required: false, example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsOptional()
  gradeId?: string;

  @ApiProperty({
    required: false,
    description: "Stream ID (Natural Science or Social Science)",
    example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  })
  @IsOptional()
  streamId?: string;

  @ApiProperty({ required: false, example: "fcm_token_sample_xyz123" })
  @IsOptional()
  fcmId?: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @Matches(PHONE_DIGITS, { message: "phoneNumber must contain digits only" })
  @MaxLength(15)
  phoneNumber: string;

  @ApiProperty({ minLength: OTP_LENGTH, maxLength: OTP_LENGTH, example: "123456" })
  @IsOptional()
  @MinLength(OTP_LENGTH)
  @MaxLength(OTP_LENGTH)
  @Matches(/^\d+$/, { message: "otp must be 6 digits" })
  otp?: string;

  @ApiProperty({ required: false, example: "123456" })
  @IsOptional()
  code?: string;

  @ApiProperty({ required: false, example: "student" })
  @IsOptional()
  type?: string;
}

export class RegisterSetPasswordDto {
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @Matches(PHONE_DIGITS, { message: "phoneNumber must contain digits only" })
  @MaxLength(15)
  phoneNumber: string;
  @ApiProperty({ minLength: 6, example: "Password123!" })
  @IsNotEmpty()
  @MinLength(6, { message: "password must be at least 6 characters" })
  @MaxLength(64, { message: "password must not exceed 64 characters" })
  password: string;
  @ApiProperty({ example: "Password123!" })
  @IsNotEmpty()
  @Match(RegisterSetPasswordDto, (s) => s.password, {
    message: "confirmPassword must match password",
  })
  @MaxLength(64)
  confirmPassword: string;

  @ApiProperty({ required: false, example: "fcm_token_sample_xyz123" })
  @IsOptional()
  fcmId?: string;
}

export class ForgotPasswordRequestDto {
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @MaxLength(15)
  phoneNumber: string;
}

export class ForgotPasswordVerifyOtpDto {
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @Matches(PHONE_DIGITS, { message: "phoneNumber must contain digits only" })
  @MaxLength(15)
  phoneNumber: string;
  @ApiProperty({ minLength: OTP_LENGTH, maxLength: OTP_LENGTH, example: "654321" })
  @IsNotEmpty()
  @MinLength(OTP_LENGTH)
  @MaxLength(OTP_LENGTH)
  @Matches(/^\d+$/, { message: "otp must be 6 digits" })
  otp: string;
}

export class ForgotPasswordResetDto {
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @Matches(PHONE_DIGITS, { message: "phoneNumber must contain digits only" })
  @MaxLength(15)
  phoneNumber: string;
  @ApiProperty({ minLength: 6, example: "NewPassword123!" })
  @IsNotEmpty()
  @MinLength(6, { message: "password must be at least 6 characters" })
  @MaxLength(64, { message: "password must not exceed 64 characters" })
  password: string;
  @ApiProperty({ example: "NewPassword123!" })
  @IsNotEmpty()
  @Match(ForgotPasswordResetDto, (s) => s.password, {
    message: "confirmPassword must match password",
  })
  @MaxLength(64)
  confirmPassword: string;
}

export class SendOtpCommand {
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @MaxLength(15)
  phoneNumber: string;
}

export class ChangePasswordCommand {
  @ApiProperty({ description: "Current (old) password", example: "OldPassword123!" })
  @IsNotEmpty({ message: "Current password is required" })
  @MinLength(6, { message: "Current password must be at least 6 characters" })
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ description: "New password", minLength: 6, maxLength: 64, example: "NewPassword123!" })
  @IsNotEmpty({ message: "New password is required" })
  @MinLength(6, { message: "New password must be at least 6 characters" })
  @MaxLength(64, { message: "New password must not exceed 64 characters" })
  password: string;

  @ApiProperty({ description: "Confirm new password", example: "NewPassword123!" })
  @IsNotEmpty({ message: "Password confirmation is required" })
  @Match(ChangePasswordCommand, (s) => s.password, {
    message: "Passwords do not match",
  })
  @MaxLength(64)
  confirmPassword: string;

  currentUser: UserInfo;
}

export class ForgotPasswordCommand {
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @MaxLength(15)
  phoneNumber: string;
  @ApiProperty({ example: "student" })
  @IsNotEmpty()
  type: string;
}

export class UpdatePasswordCommand {
  @ApiProperty({ minLength: 6, example: "NewPassword123!" })
  @IsNotEmpty()
  @MinLength(6, { message: "password must be at least 6 characters" })
  @MaxLength(64, { message: "password must not exceed 64 characters" })
  password: string;
  @ApiProperty({ example: "NewPassword123!" })
  @IsNotEmpty()
  @Match(UpdatePasswordCommand, (s) => s.password, {
    message: "Please confirm your password",
  })
  @MaxLength(64)
  confirmPassword: string;
  @ApiProperty({ example: "student" })
  type: string;
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @MaxLength(15)
  phoneNumber: string;
}

export class UpdatePasswordCommandApp {
  @ApiProperty({ minLength: 6, example: "NewPassword123!" })
  @IsNotEmpty()
  @MinLength(6, { message: "password must be at least 6 characters" })
  @MaxLength(64, { message: "password must not exceed 64 characters" })
  password: string;
  @ApiProperty({ example: "NewPassword123!" })
  @IsNotEmpty()
  @Match(UpdatePasswordCommand, (s) => s.password, {
    message: "Please confirm your password",
  })
  @MaxLength(64)
  confirmPassword: string;
  @ApiProperty({ example: "student" })
  type: string;
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @MaxLength(15)
  phoneNumber: string;
}

export class ResetPasswordCommand {
  @ApiProperty({ minLength: 6, example: "NewPassword123!" })
  @IsNotEmpty()
  @MinLength(6, { message: "password must be at least 6 characters" })
  @MaxLength(64, { message: "password must not exceed 64 characters" })
  password: string;
  @ApiProperty({ example: "NewPassword123!" })
  @IsNotEmpty()
  @Match(ResetPasswordCommand, (s) => s.password, {
    message: "Please confirm your password",
  })
  @MaxLength(64)
  confirmPassword: string;
  @ApiProperty({ example: "reset_token_xyz123" })
  @IsNotEmpty()
  token: string;
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsNotEmpty()
  id: string;
}

export class CheckPhoneDto {
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @MaxLength(15)
  phoneNumber: string;
}

export class RefreshTokenDto {
  @ApiProperty({ required: false, example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample_refresh_token" })
  @IsOptional()
  refreshToken?: string;
}
