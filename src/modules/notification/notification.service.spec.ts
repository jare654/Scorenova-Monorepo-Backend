import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { NotificationEntity } from "./models/notification.entity";
import { AccountEntity } from "../account/models/accounts/account.entity";
import { TempDeviceTokenEntity } from "./models/temp-device-token.entity";
import { OtpEntity } from "../account/models/otp/otp.entity";
import { AttemptEntity } from "../attempt/models/attempts/attempt.entity";

describe("NotificationService - Temp Device Token Routes & Reminders", () => {
  let service: NotificationService;
  let tempDeviceRepoMock: any;
  let otpRepoMock: any;
  let attemptRepoMock: any;
  let accountRepoMock: any;
  let notificationRepoMock: any;

  beforeEach(async () => {
    tempDeviceRepoMock = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: "uuid-1", ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: "uuid-1", ...entity })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    otpRepoMock = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: "otp-1", ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: "otp-1", ...entity })),
    };

    attemptRepoMock = {
      findOne: jest.fn(),
    };

    notificationRepoMock = {
      create: jest.fn((dto) => ({ id: "notif-1", ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: "notif-1", ...entity })),
    };

    accountRepoMock = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(NotificationEntity), useValue: notificationRepoMock },
        { provide: getRepositoryToken(AccountEntity), useValue: accountRepoMock },
        { provide: getRepositoryToken(TempDeviceTokenEntity), useValue: tempDeviceRepoMock },
        { provide: getRepositoryToken(OtpEntity), useValue: otpRepoMock },
        { provide: getRepositoryToken(AttemptEntity), useValue: attemptRepoMock },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });


  describe("registerTempDeviceToken", () => {
    it("should generate a new device tag and save to temp_device_token table when token is new", async () => {
      tempDeviceRepoMock.findOne.mockResolvedValue(null);

      const result = await service.registerTempDeviceToken("fcm-test-token-123");

      expect(result.code).toBe("DEVICE_REGISTERED");
      expect(result.deviceTag).toMatch(/^DEV-[A-Z0-9]+$/);
      expect(result.fcmToken).toBe("fcm-test-token-123");
      expect(tempDeviceRepoMock.save).toHaveBeenCalled();
    });

    it("should return existing device tag when fcm token already exists in DB", async () => {
      const existingRecord = { id: "uuid-1", deviceTag: "DEV-EXISTING", fcmToken: "fcm-test-token-123" };
      tempDeviceRepoMock.findOne.mockResolvedValue(existingRecord);

      const result = await service.registerTempDeviceToken("fcm-test-token-123");

      expect(result.code).toBe("DEVICE_REGISTERED");
      expect(result.deviceTag).toBe("DEV-EXISTING");
      expect(result.fcmToken).toBe("fcm-test-token-123");
    });

    it("should throw BadRequestException if fcmToken is empty", async () => {
      await expect(service.registerTempDeviceToken("")).rejects.toThrow(BadRequestException);
    });
  });

  describe("sendOtpNotification", () => {
    it("should fetch OTP from otps table and send notification using device tag", async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 5);
      otpRepoMock.findOne.mockResolvedValue({
        id: "otp-1",
        phoneNumber: "911234567",
        otp: "654321",
        expiresAt: futureDate,
        verified: false,
      });

      tempDeviceRepoMock.findOne.mockResolvedValue({
        id: "uuid-1",
        deviceTag: "DEV-123",
        fcmToken: "fcm-token-sample",
      });

      const result = await service.sendOtpNotification("+251911234567", "DEV-123");

      expect(result.code).toBe("OTP_NOTIFICATION_SENT");
      expect(result.message).toContain("OTP notification sent successfully");
      expect((result as any).otp).toBeUndefined(); // Ensure OTP is NOT exposed in response
    });

    it("should throw BadRequestException (OTP_NOT_FOUND) if no active OTP exists in otps table", async () => {
      otpRepoMock.findOne.mockResolvedValue(null);

      try {
        await service.sendOtpNotification("+251911234567", "DEV-123");
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        expect(res.code).toBe("OTP_NOT_FOUND");
        expect(res.message).toContain("No active OTP found");
      }
    });

    it("should throw BadRequestException if device tag does not exist", async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 5);
      otpRepoMock.findOne.mockResolvedValue({
        id: "otp-1",
        phoneNumber: "911234567",
        otp: "654321",
        expiresAt: futureDate,
        verified: false,
      });
      tempDeviceRepoMock.findOne.mockResolvedValue(null);

      await expect(service.sendOtpNotification("+251911234567", "DEV-UNKNOWN")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("sendNotificationByDeviceTag", () => {
    it("should throw BadRequestException (HTTP 400) if device tag is missing in request", async () => {
      await expect(service.sendNotificationByDeviceTag("", "Title", "Body")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException (HTTP 400) with DEVICE_TAG_NOT_FOUND if device tag does not exist in DB", async () => {
      tempDeviceRepoMock.findOne.mockResolvedValue(null);

      try {
        await service.sendNotificationByDeviceTag("DEV-NOT-FOUND", "Title", "Body");
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        expect(res.code).toBe("DEVICE_TAG_NOT_FOUND");
        expect(res.message).toContain("Device tag not found");
      }
    });

    it("should throw BadRequestException (HTTP 400) with FCM_TOKEN_MISSING if record exists but token is empty", async () => {
      tempDeviceRepoMock.findOne.mockResolvedValue({ id: "uuid-1", deviceTag: "DEV-1", fcmToken: "" });

      try {
        await service.sendNotificationByDeviceTag("DEV-1", "Title", "Body");
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        expect(res.code).toBe("FCM_TOKEN_MISSING");
      }
    });
  });

  describe("sendDailyPracticeReminders", () => {
    it("should send personalized daily practice reminders to all accounts with fcmId", async () => {
      const mockAccounts = [
        { id: "user-1", fcmId: "fcm-token-user-1", firstName: "Abebe" },
        { id: "user-2", fcmId: "fcm-token-user-2", firstName: "Kebede" },
      ];

      accountRepoMock.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockAccounts),
      });

      attemptRepoMock.findOne
        .mockResolvedValueOnce({
          id: "att-1",
          subject: { name: "Physics" },
        })
        .mockResolvedValueOnce(null);

      const result = await service.sendDailyPracticeReminders();

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.sent).toBe(2);
      expect(notificationRepoMock.save).toHaveBeenCalledTimes(2);
    });

    it("should return early when no accounts have FCM tokens", async () => {
      accountRepoMock.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.sendDailyPracticeReminders();

      expect(result.success).toBe(true);
      expect(result.total).toBe(0);
      expect(result.sent).toBe(0);
    });
  });
});


