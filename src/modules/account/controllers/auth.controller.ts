import * as jwt from "jsonwebtoken";

import {
  ChangePasswordCommand,
  ForgotPasswordCommand,
  ForgotPasswordRequestDto,
  ForgotPasswordResetDto,
  ForgotPasswordVerifyOtpDto,
  LoginDto,
  RegisterSetPasswordDto,
  RegisterStepOneDto,
  ResetPasswordCommand,
  SendOtpCommand,
  UpdatePasswordCommand,
  UpdatePasswordCommandApp,
  UserLoginCommand,
  VerifyOtpDto,
  CheckPhoneDto,
  RefreshTokenDto,
} from "@account/auth/commands/auth.commands";
import { AllowAnonymous } from "@account/auth/decorators/allow-anonymous.decorator";
import { CurrentUser } from "@account/auth/decorators/current-user.decorator";
import { UserInfo, UserInfoDto } from "@account/auth/dtos/user-info.dto";
import { JwtAuthGuard } from "@account/auth/guards/jwt-auth.guard";
import { AuthFlowService } from "@account/auth/services/auth-flow.service";
import { AuthService } from "@account/auth/services/auth.service";
import { OtpService } from "@account/auth/services/otp.service";
import { Util } from "@libs/common/util";
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { SessionCommands } from "@account/usecases/sessions/session.usecase.commands";
import { SessionQuery } from "@account/usecases/sessions/session.usecase.queries";
import { IsNotEmpty, MaxLength, MinLength } from "class-validator";

export class FixBrokenPasswordDto {
  @ApiProperty({ example: "0912345678" })
  @IsNotEmpty()
  @MaxLength(15)
  phoneNumber: string;

  @ApiProperty({ minLength: 6, example: "NewPassword123!" })
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(64)
  newPassword: string;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authFlowService: AuthFlowService,
    private readonly otpService: OtpService,
    private readonly sessionCommand: SessionCommands,
    private readonly sessionQuery: SessionQuery,
  ) {}

  @Post("register-step-one")
  @AllowAnonymous()
  @ApiOperation({
    summary: "Registration Step 1: Initiate registration & request OTP",
    description: "Accepts user phone number and name, validates availability, and sends verification OTP code via SMS.",
  })
  async registerStepOne(@Body() body: RegisterStepOneDto) {
    return this.authFlowService.registerStepOne(body);
  }

  @Post("verify-otp")
  @AllowAnonymous()
  @ApiOperation({
    summary: "Registration Step 2: Verify registration OTP code",
    description: "Verifies the 6-digit OTP code sent during registration step 1.",
  })
  async verifyOtpRegistration(@Body() body: VerifyOtpDto) {
    return this.authFlowService.verifyOtp(body);
  }

  @Post("register-set-password")
  @AllowAnonymous()
  @ApiOperation({
    summary: "Registration Step 3: Complete registration by setting password",
    description: "Sets account password and activates user account after OTP verification.",
  })
  async registerSetPassword(@Body() body: RegisterSetPasswordDto) {
    return this.authFlowService.registerSetPassword(body);
  }

  @Post("login")
  @AllowAnonymous()
  @ApiOperation({
    summary: "User login with phone number and password",
    description: "Authenticates user credentials and returns JWT access token, refresh token, and user profile.",
  })
  async login(@Body() body: LoginDto) {
    return this.authFlowService.login(body);
  }

  @Post("otp/send")
  @AllowAnonymous()
  @ApiOperation({
    summary: "Send OTP code to phone number",
    description: "Generates and sends a new OTP code to specified phone number.",
  })
  async sendOtp(@Body() body: SendOtpCommand) {
    return this.otpService.generate(body.phoneNumber);
  }

  @Get("get-user-info")
  @ApiBearerAuth("Bearer")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Get current authenticated user profile",
    description: "Retrieves complete user information and permissions from active JWT token.",
  })
  @ApiOkResponse({
    description: "Successfully retrieved current user info",
    type: UserInfoDto,
  })
  @ApiUnauthorizedResponse({
    description: "Unauthorized - Token missing, invalid, or expired",
  })
  async getUserInfo(@CurrentUser() user: UserInfo) {
    return user;
  }
  @Post("refresh")
  @AllowAnonymous()
  @ApiOperation({
    summary: "Refresh access token",
    description: "Exchanges a valid refresh token for a new access token and refresh token pair.",
  })
  async getRefreshToken(@Headers() headers: object, @Body() body: RefreshTokenDto) {
    const refreshToken = (headers["x-refresh-token"] as string) || body.refreshToken;
    if (!refreshToken) {
      throw new ForbiddenException(`Refresh token required`);
    }
    try {
      const secret = process.env.REFRESH_SECRET_TOKEN;
      if (!secret) {
        throw new UnauthorizedException("Refresh token not configured");
      }
      const p = jwt.verify(refreshToken, secret, {
        algorithms: ["HS256"],
      }) as UserInfo;

      const session = await this.sessionQuery.getSessionByRefreshToken(
        refreshToken,
      );
      if (!session) {
        await this.sessionCommand.revokeAllSessionsByAccountId(p.id);
        throw new UnauthorizedException(
          "Refresh token replay detected. Please login again.",
        );
      }
      if (session.deletedAt) {
        await this.sessionCommand.revokeAllSessionsByAccountId(session.accountId);
        throw new UnauthorizedException(
          "Refresh token replay detected. Please login again.",
        );
      }

      const nextPayload: UserInfo = {
        id: p.id,
        email: p.email,
        name: p.name,
        gender: p.gender,
        type: p.type,
        gradeId: p.gradeId,
        streamId: p.streamId,
        profileImageFilename: p.profileImageFilename,
        address: p.address,
        role: p.role,
        fcmId: p.fcmId,
        phoneNumber: p?.phoneNumber,
        permissions: p?.permissions,
      };
      await this.sessionCommand.deleteSessionByRefreshToken(refreshToken);
      const nextAccessToken = Util.GenerateToken(nextPayload, "30d");
      const nextRefreshToken = Util.GenerateRefreshToken(nextPayload);
      await this.sessionCommand.createSession({
        accountId: nextPayload.id,
        token: nextAccessToken,
        refreshToken: nextRefreshToken,
      });
      return {
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException(error?.message ?? "Invalid refresh token");
    }
  }
  @Post("change-password")
  @ApiBearerAuth("Bearer")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Change password for logged-in user",
    description: "Allows authenticated user to update their password by providing current and new password.",
  })
  async changePassword(
    @CurrentUser() user: UserInfo,
    @Body() changePasswordCommand: ChangePasswordCommand
  ) {
    changePasswordCommand.currentUser = user;
    return this.authService.changePassword(changePasswordCommand);
  }
  @Post("forgot-password")
  @AllowAnonymous()
  @ApiOperation({
    summary: "Forgot Password Step 1: Request password reset OTP",
    description: "Initiates password reset for account by phone number and sends OTP code.",
  })
  async forgotPassword(@Body() body: ForgotPasswordRequestDto) {
    return this.authFlowService.forgotPassword(body);
  }

  @Post("forgot-password-verify-otp")
  @AllowAnonymous()
  @ApiOperation({
    summary: "Forgot Password Step 2: Verify password reset OTP",
    description: "Verifies the OTP code sent during forgot password request.",
  })
  async forgotPasswordVerifyOtp(@Body() body: ForgotPasswordVerifyOtpDto) {
    return this.authFlowService.forgotPasswordVerifyOtp(body);
  }

  @Post("forgot-password-reset")
  @AllowAnonymous()
  @ApiOperation({
    summary: "Forgot Password Step 3: Set new password after OTP verification",
    description: "Resets user password following successful OTP verification.",
  })
  async forgotPasswordReset(@Body() body: ForgotPasswordResetDto) {
    return this.authFlowService.forgotPasswordReset(body);
  }

  @Post("check-phone")
  @AllowAnonymous()
  @ApiOperation({
    summary: "Check if phone number is registered",
    description: "Checks whether specified phone number already exists in the system.",
  })
  async checkPhone(@Body() body: CheckPhoneDto) {
    return this.authFlowService.checkPhone(body.phoneNumber);
  }

  @Post("fix-broken-password")
  @AllowAnonymous()
  @ApiOperation({
    summary: "Fix account with corrupted password hash",
    description:
      "Only works if the stored password hash is invalid (caused by BcryptHashRound=NaN bug). " +
      "If the hash is valid, this endpoint returns an error and the user must use forgot-password instead.",
  })
  async fixBrokenPassword(@Body() body: FixBrokenPasswordDto) {
    return this.authFlowService.fixBrokenPassword(body.phoneNumber, body.newPassword);
  }

  @Post("reset-password")
  @AllowAnonymous()
  @ApiOperation({
    summary: "Reset password using reset token",
    description: "Token-based password reset completion.",
  })
  async resetPassword(@Body() command: ResetPasswordCommand) {
    return this.authService.resetPassword(command);
  }
  @Get("switch-role/:roleId")
  @ApiBearerAuth("Bearer")
  @ApiOperation({
    summary: "Switch active role for multi-role account",
    description: "Switches current session active role context to specified roleId.",
  })
  async switchRole(
    @Param("roleId") roleId: string,
    @CurrentUser() currentUser: UserInfo
  ) {
    return this.authService.switchRole(roleId, currentUser);
  }
  @Post("logout")
  @ApiBearerAuth("Bearer")
  @ApiOperation({
    summary: "Logout user and invalidate active session",
    description: "Revokes current access token session.",
  })
  async logout(@Headers() headers: object) {
    const authorization: string = headers["authorization"] ?? "";
    if (!authorization) return true;
    const parts = authorization.split(" ");
    const token = parts[1];
    if (!token) return true;
    await this.sessionCommand.deleteSessionByToken(token);
    return true;
  }
}
