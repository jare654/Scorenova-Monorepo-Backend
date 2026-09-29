import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CurrentUser } from "@account/auth/decorators/current-user.decorator";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { NotificationEntity } from "../models/notification.entity";
import { Repository } from "typeorm";
import { JwtAuthGuard } from "@account/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@account/auth/guards/role.quards";
import { Public } from "@account/auth/decorators/public.decorator";
import { NotificationService } from "../notification.service";
import { AccountEntity } from "../../account/models/accounts/account.entity";
import {
  RegisterTempDeviceTokenDto,
  SendOtpNotificationDto,
  SendNotificationByDeviceTagDto,
} from "../dto/temp-device-token.dto";

export class UpdateFcmTokenDto {
  @ApiProperty({ example: "fcm_token_sample_xyz123" })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}

export class BroadcastNotificationDto {
  @ApiProperty({ example: "New Exam Released!" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: "Grade 12 Physics National Mock Exam is now live." })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    description: "Target audience: 'all' | 'premium' | 'free'. Defaults to 'all'.",
    enum: ["all", "premium", "free"],
    example: "all",
  })
  @IsOptional()
  @IsString()
  target?: "all" | "premium" | "free";
}

@ApiTags("notifications")
@Controller("notifications")
@ApiBearerAuth("Bearer")
export class NotificationController {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    private readonly notificationService: NotificationService,
  ) {}

  @Get("get-my-notifications")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get my notifications" })
  async getMyNotifications(@CurrentUser() user: UserInfo) {
    const notifications = await this.notificationRepo.find({
      where: { accountId: user.id },
      order: { createdAt: "DESC" },
    });
    return notifications;
  }

  @Post("fcm-token")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Register or refresh FCM token for current logged-in user" })
  async updateFcmToken(
    @CurrentUser() user: UserInfo,
    @Body() dto: UpdateFcmTokenDto,
  ) {
    return this.notificationService.updateFcmToken(user.id, dto.fcmToken);
  }

  @Post("broadcast")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Broadcast push notification to all/premium/free users (Admin Only)",
    description:
      "Sends a Firebase push notification to every user that has an FCM token and creates an inbox notification for all target users. " +
      "Use target='premium' to reach only premium users, 'free' for non-premium, 'all' for everyone.",
  })
  async broadcast(@Body() dto: BroadcastNotificationDto) {
    const target = dto.target ?? "all";
    return this.notificationService.broadcastNotification(dto.title, dto.body, target);
  }

  @Public()
  @Post("temp-device/register")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Register temporary device FCM token on app launch",
    description:
      "Accepts only fcmToken in request body. The backend automatically generates a unique device tag and saves both to temp_device_token table. Returns 200 OK with generated deviceTag.",
  })
  @ApiResponse({
    status: 200,
    description: "Device registered successfully",
    schema: {
      example: {
        code: "DEVICE_REGISTERED",
        message: "Device token registered successfully",
        deviceTag: "DEV-8F4B2A1C99D1",
        fcmToken: "fcm_token_sample_abc123xyz789",
      },
    },
  })
  async registerTempDeviceToken(@Body() dto: RegisterTempDeviceTokenDto) {
    return this.notificationService.registerTempDeviceToken(dto.fcmToken);
  }

  /**
   * Route 2: Send OTP Push Notification by Device Tag
   * Accepts phoneNumber and deviceTag in request.
   * Fetches existing OTP from otps table, fetches FCM token from temp_device_token table using deviceTag,
   * and dispatches Firebase notification. Returns success code without exposing the OTP or sensitive data.
   * Full Endpoint Path: POST /api/v1/notifications/temp-device/send-otp-notification
   */
  @Public()
  @Post("temp-device/send-otp-notification")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Send OTP notification to user device using device tag",
    description:
      "Accepts phoneNumber and deviceTag. Fetches existing OTP from otps table, fetches FCM token from temp_device_token table using deviceTag, and sends notification to user. Returns success code without exposing the OTP code.",
  })
  @ApiResponse({
    status: 200,
    description: "OTP notification sent successfully",
    schema: {
      example: {
        code: "OTP_NOTIFICATION_SENT",
        message: "OTP notification sent successfully to device",
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad Request - Tag not found or missing parameters",
    schema: {
      example: {
        code: "DEVICE_TAG_NOT_FOUND",
        message: "Device tag not found. Please register device token again.",
      },
    },
  })
  async sendOtpNotification(@Body() dto: SendOtpNotificationDto) {
    return this.notificationService.sendOtpNotification(dto.phoneNumber, dto.deviceTag);
  }

  /**
   * Route 3: Send Push Notification by Device Tag (General/Custom)
   * Full Endpoint Path: POST /api/v1/notifications/temp-device/send-notification
   */
  @Public()
  @Post("temp-device/send-notification")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Send Firebase push notification using device tag",
    description:
      "Fetches FCM token from temp_device_token table using deviceTag and dispatches Firebase notification.",
  })
  async sendNotificationByDeviceTag(@Body() dto: SendNotificationByDeviceTagDto) {
    return this.notificationService.sendNotificationByDeviceTag(
      dto.deviceTag,
      dto.title,
      dto.body,
      dto.data,
    );
  }

  @Post("practice-reminder/send-daily")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Manually trigger daily practice reminder push notifications (Admin Only)",
    description:
      "Sends daily practice reminder push notifications and inbox messages to all student accounts with valid FCM tokens based on their past exam attempts.",
  })
  async triggerDailyPracticeReminders() {
    return this.notificationService.sendDailyPracticeReminders();
  }
}

