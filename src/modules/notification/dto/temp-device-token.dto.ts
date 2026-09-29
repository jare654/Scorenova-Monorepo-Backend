import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsObject } from "class-validator";

export class RegisterTempDeviceTokenDto {
  @ApiProperty({
    description: "FCM token generated from the user device",
    example: "fcm_token_sample_abc123xyz789",
  })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}

export class SendOtpNotificationDto {
  @ApiProperty({
    description: "Phone number of the user to send OTP to",
    example: "+251911234567",
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    description: "Device tag used to look up FCM token in temp_device_token table",
    example: "DEV-8F4B2A1C99D1",
  })
  @IsString()
  @IsNotEmpty()
  deviceTag: string;
}

export class SendNotificationByDeviceTagDto {
  @ApiProperty({
    description: "Device tag used to look up FCM token in temp_device_token table",
    example: "DEV-8F4B2A1C99D1",
  })
  @IsString()
  @IsNotEmpty()
  deviceTag: string;

  @ApiProperty({
    description: "Notification title",
    example: "Solanova Exam Alert",
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: "Notification body message",
    example: "New practice quiz is available now!",
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    description: "Optional payload object sent with notification data",
    example: { type: "MOCK_EXAM", id: "123" },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}

