import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { NotificationEntity } from "./models/notification.entity";
import { TempDeviceTokenEntity } from "./models/temp-device-token.entity";
import { AccountEntity } from "../account/models/accounts/account.entity";
import { OtpEntity } from "../account/models/otp/otp.entity";
import { AttemptEntity } from "../attempt/models/attempts/attempt.entity";
import { Util } from "../../libs/common/util";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    @InjectRepository(TempDeviceTokenEntity)
    private readonly tempDeviceTokenRepo: Repository<TempDeviceTokenEntity>,
    @InjectRepository(OtpEntity)
    private readonly otpRepo: Repository<OtpEntity>,
    @InjectRepository(AttemptEntity)
    private readonly attemptRepo: Repository<AttemptEntity>,
  ) {}



  private isFirebaseInitialized(): boolean {
    return admin.apps.length > 0;
  }

  /**
   * Update FCM token for a given account.
   */
  async updateFcmToken(accountId: string, fcmToken: string): Promise<{ success: boolean }> {
    await this.accountRepo.update(accountId, { fcmId: fcmToken });
    return { success: true };
  }

  /**
   * 1. Register temporary device FCM token when user opens the app.
   * Only accepts fcmToken from request; device tag is automatically generated on backend.
   */
  async registerTempDeviceToken(fcmToken: string) {
    if (!fcmToken || fcmToken.trim() === "") {
      throw new BadRequestException({
        code: "FCM_TOKEN_REQUIRED",
        message: "FCM token is required to register device.",
      });
    }

    const trimmedToken = fcmToken.trim();

    // Check if token already exists in temp_device_token table
    let record = await this.tempDeviceTokenRepo.findOne({
      where: { fcmToken: trimmedToken },
    });

    if (record) {
      return {
        code: "DEVICE_REGISTERED",
        message: "Device token registered successfully",
        deviceTag: record.deviceTag,
        fcmToken: record.fcmToken,
      };
    }

    // Backend generates unique device tag: e.g. DEV-8F4B2A1C99D1
    const generatedTag = `DEV-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const newRecord = this.tempDeviceTokenRepo.create({
      deviceTag: generatedTag,
      fcmToken: trimmedToken,
    });

    await this.tempDeviceTokenRepo.save(newRecord);

    return {
      code: "DEVICE_REGISTERED",
      message: "Device token registered successfully",
      deviceTag: newRecord.deviceTag,
      fcmToken: newRecord.fcmToken,
    };
  }

  /**
   * 2. Send OTP via FCM push notification using deviceTag.
   * Accepts phoneNumber and deviceTag.
   * Fetches active OTP from otps table (does NOT create or save to otps table),
   * fetches FCM token from temp_device_token table using deviceTag,
   * sends push notification of that OTP code to user, and returns success code without exposing sensitive details.
   */
  async sendOtpNotification(phoneNumber: string, deviceTag: string) {
    if (!phoneNumber || phoneNumber.trim() === "") {
      throw new BadRequestException({
        code: "PHONE_NUMBER_REQUIRED",
        message: "Phone number parameter is required.",
      });
    }

    if (!deviceTag || deviceTag.trim() === "") {
      throw new BadRequestException({
        code: "DEVICE_TAG_NOT_FOUND",
        message: "Device tag parameter is missing or empty. Please register device token again.",
      });
    }

    const rawPhone = phoneNumber.trim();
    const normalizedPhone = Util.normalizePhone(rawPhone);
    const now = new Date();

    // 1. Fetch user OTP from otps table (latest unexpired & unverified OTP)
    const otpRecord = await this.otpRepo.findOne({
      where: [
        { phoneNumber: normalizedPhone, verified: false },
        { phoneNumber: rawPhone, verified: false },
      ],
      order: { createdAt: "DESC" },
    });

    if (!otpRecord || otpRecord.expiresAt <= now) {
      throw new BadRequestException({
        code: "OTP_NOT_FOUND",
        message: "No active OTP found for this phone number. Please request a new OTP.",
      });
    }

    const otpCode = otpRecord.otp;


    // 2. Fetch FCM token from temp_device_token table using deviceTag
    const deviceRecord = await this.tempDeviceTokenRepo.findOne({
      where: { deviceTag: deviceTag.trim() },
    });

    if (!deviceRecord) {
      throw new BadRequestException({
        code: "DEVICE_TAG_NOT_FOUND",
        message: "Device tag not found. Please register device token again.",
      });
    }

    if (!deviceRecord.fcmToken || deviceRecord.fcmToken.trim() === "") {
      throw new BadRequestException({
        code: "FCM_TOKEN_MISSING",
        message: "FCM token is missing for this device tag. Please register device token again.",
      });
    }

    // 3. Send notification containing OTP code to user device
    const title = "Your OTP Code";
    const body = `Your OTP verification code is ${otpCode}. It will expire in 10 minutes.`;

    if (!this.isFirebaseInitialized()) {
      this.logger.warn(
        `Firebase is not initialized. Sent OTP notification mock for ${normalizedPhone}`,
      );
      return {
        code: "OTP_NOTIFICATION_SENT",
        message: "OTP notification sent successfully to device",
      };
    }

    try {
      await admin.messaging().send({
        token: deviceRecord.fcmToken,
        notification: { title, body },
        data: {
          type: "OTP_NOTIFICATION",
          title,
          body,
        },
        android: { priority: "high" },
        apns: { payload: { aps: { sound: "default" } } },
      });

      return {
        code: "OTP_NOTIFICATION_SENT",
        message: "OTP notification sent successfully to device",
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to send Firebase notification to device tag ${deviceTag}: ${error?.message ?? error}`,
      );

      const errCode = error?.code;
      if (
        errCode === "messaging/invalid-registration-token" ||
        errCode === "messaging/registration-token-not-registered"
      ) {
        await this.tempDeviceTokenRepo.delete({ id: deviceRecord.id });
        throw new BadRequestException({
          code: "INVALID_FCM_TOKEN",
          message: "Device token has expired or is invalid. Please register device token again.",
        });
      }

      throw new BadRequestException({
        code: "NOTIFICATION_FAILED",
        message: `Failed to send notification: ${error?.message ?? "Unknown error"}`,
      });
    }
  }

  /**
   * 3. Fetch FCM token from temp_device_token table using deviceTag and send Firebase push notification.

   * Throws BadRequestException (HTTP 400) when deviceTag is not found or token is invalid.
   */
  async sendNotificationByDeviceTag(
    deviceTag: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!deviceTag || deviceTag.trim() === "") {
      throw new BadRequestException({
        code: "DEVICE_TAG_NOT_FOUND",
        message: "Device tag parameter is missing or empty. Please register device token again.",
      });
    }

    const record = await this.tempDeviceTokenRepo.findOne({
      where: { deviceTag: deviceTag.trim() },
    });

    if (!record) {
      throw new BadRequestException({
        code: "DEVICE_TAG_NOT_FOUND",
        message: "Device tag not found. Please register device token again.",
      });
    }

    if (!record.fcmToken || record.fcmToken.trim() === "") {
      throw new BadRequestException({
        code: "FCM_TOKEN_MISSING",
        message: "FCM token is missing for this device tag. Please register device token again.",
      });
    }

    if (!this.isFirebaseInitialized()) {
      this.logger.warn("Firebase is not initialized. Cannot send push notification.");
      throw new BadRequestException({
        code: "FIREBASE_NOT_CONFIGURED",
        message: "Firebase Admin SDK is not configured on backend.",
      });
    }

    try {
      const payloadData: Record<string, string> = { title, body, ...(data || {}) };

      await admin.messaging().send({
        token: record.fcmToken,
        notification: { title, body },
        data: payloadData,
        android: { priority: "high" },
        apns: { payload: { aps: { sound: "default" } } },
      });

      return {
        code: "NOTIFICATION_SENT",
        message: "Notification successfully sent to device",
        deviceTag: record.deviceTag,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to send Firebase notification to device tag ${deviceTag}: ${error?.message ?? error}`,
      );

      const errCode = error?.code;
      if (
        errCode === "messaging/invalid-registration-token" ||
        errCode === "messaging/registration-token-not-registered"
      ) {
        // Delete invalid token record so client knows to re-register
        await this.tempDeviceTokenRepo.delete({ id: record.id });
        throw new BadRequestException({
          code: "INVALID_FCM_TOKEN",
          message: "Device token has expired or is invalid. Please register device token again.",
        });
      }

      throw new BadRequestException({
        code: "NOTIFICATION_FAILED",
        message: `Failed to send notification: ${error?.message ?? "Unknown error"}`,
      });
    }
  }

  /**
   * Send notification to a single user (saves in DB inbox + sends FCM push).
   */
  async sendToUser(accountId: string, title: string, body: string, fcmToken?: string) {
    // 1. Save in DB inbox
    const notification = this.notificationRepo.create({
      accountId,
      title,
      body,
    });
    await this.notificationRepo.save(notification);

    // 2. Send via Firebase if token exists and Firebase is initialized
    if (fcmToken && this.isFirebaseInitialized()) {
      try {
        await admin.messaging().send({
          token: fcmToken,
          notification: { title, body },
          data: { title, body },
          android: { priority: "high" },
          apns: { payload: { aps: { sound: "default" } } },
        });
      } catch (error: any) {
        this.logger.error(`Failed to send Firebase notification to user ${accountId}: ${error?.message ?? error}`);
        if (
          error?.code === "messaging/invalid-registration-token" ||
          error?.code === "messaging/registration-token-not-registered"
        ) {
          this.logger.warn(`Removing invalid FCM token for account ${accountId}`);
          await this.accountRepo.update(accountId, { fcmId: undefined });
        }
      }
    }

    return { success: true };
  }

  /**
   * Broadcast push notification to targeted users (all, premium, free).
   * Saves notification to DB inbox for all targeted accounts and sends FCM push in batches.
   */
  async broadcastNotification(title: string, body: string, target: "all" | "premium" | "free" = "all") {
    const qb = this.accountRepo
      .createQueryBuilder("a")
      .select(["a.id", "a.fcmId", "a.isPremium"])
      .where("a.type = 'student'")
      .andWhere("a.status = 'active'");

    if (target === "premium") {
      qb.andWhere("a.isPremium = true");
    } else if (target === "free") {
      qb.andWhere("a.isPremium = false");
    }

    const accounts = await qb.getMany();
    if (accounts.length === 0) {
      return { success: true, total: 0, sent: 0, failed: 0, noToken: 0 };
    }

    // 1. Create DB notification records for all targeted accounts so they appear in user inbox
    const dbNotifications = accounts.map((a) =>
      this.notificationRepo.create({ accountId: a.id, title, body }),
    );

    // Save in batches of 500 to DB
    const DB_BATCH = 500;
    for (let i = 0; i < dbNotifications.length; i += DB_BATCH) {
      await this.notificationRepo.save(dbNotifications.slice(i, i + DB_BATCH));
    }

    // 2. Filter accounts with valid FCM tokens
    const accountsWithToken = accounts.filter((a) => a.fcmId && a.fcmId.trim() !== "");
    const noToken = accounts.length - accountsWithToken.length;

    let sent = 0;
    let failed = 0;
    const invalidAccountIds: string[] = [];

    if (!this.isFirebaseInitialized()) {
      this.logger.warn("Firebase is not initialized. Notifications saved to DB inbox only.");
      return {
        success: true,
        total: accounts.length,
        sent: 0,
        failed: 0,
        noToken,
        warning: "Firebase Admin is not configured on the backend.",
      };
    }

    // 3. Batch FCM push using sendEachForMulticast (up to 500 per call)
    const FCM_BATCH = 500;
    for (let i = 0; i < accountsWithToken.length; i += FCM_BATCH) {
      const batchAccounts = accountsWithToken.slice(i, i + FCM_BATCH);
      const tokens = batchAccounts.map((a) => a.fcmId);

      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens,
          notification: { title, body },
          data: { title, body },
          android: { priority: "high" },
          apns: { payload: { aps: { sound: "default" } } },
        });

        sent += response.successCount;
        failed += response.failureCount;

        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errCode = resp.error?.code;
            if (
              errCode === "messaging/invalid-registration-token" ||
              errCode === "messaging/registration-token-not-registered"
            ) {
              invalidAccountIds.push(batchAccounts[idx].id);
            }
          }
        });
      } catch (err: any) {
        this.logger.error(`Error sending FCM batch: ${err?.message ?? err}`);
        failed += batchAccounts.length;
      }
    }

    // Clear invalid tokens from DB
    if (invalidAccountIds.length > 0) {
      this.logger.log(`Clearing ${invalidAccountIds.length} invalid FCM tokens from database.`);
      await this.accountRepo.update({ id: In(invalidAccountIds) }, { fcmId: undefined });
    }

    return {
      success: true,
      total: accounts.length,
      sent,
      failed,
      noToken,
      invalidTokensCleaned: invalidAccountIds.length,
    };
  }

  /**
   * Daily Cronjob: Automatically send personalized practice reminders to all student accounts
   * that have an fcmId on their accounts table.
   * Tailored according to the user's exam attempt history.
   * Runs automatically every day at 10:00 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async sendDailyPracticeReminders() {
    this.logger.log("Starting daily practice reminder push notifications cron job...");

    // 1. Query all active student accounts with non-empty fcmId
    const accounts = await this.accountRepo
      .createQueryBuilder("a")
      .select(["a.id", "a.fcmId", "a.firstName", "a.username"])
      .where("a.type = 'student'")
      .andWhere("a.status = 'active'")
      .andWhere("a.fcmId IS NOT NULL")
      .andWhere("a.fcmId != ''")
      .getMany();

    if (accounts.length === 0) {
      this.logger.log("No student accounts with FCM token found for daily practice reminder.");
      return { success: true, total: 0, sent: 0, failed: 0 };
    }

    this.logger.log(`Found ${accounts.length} student account(s) with FCM token to receive daily reminder.`);

    let sentCount = 0;
    let failedCount = 0;
    const isFbInit = this.isFirebaseInitialized();
    const invalidAccountIds: string[] = [];

    for (const account of accounts) {
      // 2. Fetch the user's latest exam attempt to tailor notification content
      const latestAttempt = await this.attemptRepo.findOne({
        where: { accountId: account.id },
        relations: ["subject"],
        order: { createdAt: "DESC" },
      });

      let title: string;
      let body: string;

      if (latestAttempt && latestAttempt.subject && latestAttempt.subject.name) {
        const subjectName = latestAttempt.subject.name;
        title = "Daily Practice Reminder 📚";
        body = `Keep your streak alive! Ready to practice more ${subjectName} questions today?`;
      } else {
        title = "Daily Exam Practice Reminder 🎯";
        body = "Keep your study momentum going! Take today's practice quizzes and mock exams now.";
      }

      // 3. Save notification in DB inbox
      const dbNotification = this.notificationRepo.create({
        accountId: account.id,
        title,
        body,
      });
      await this.notificationRepo.save(dbNotification);

      // 4. Send Firebase push notification if FCM token is present
      if (isFbInit && account.fcmId) {
        try {
          await admin.messaging().send({
            token: account.fcmId,
            notification: { title, body },
            data: {
              type: "PRACTICE_REMINDER",
              title,
              body,
            },
            android: { priority: "high" },
            apns: { payload: { aps: { sound: "default" } } },
          });
          sentCount++;
        } catch (error: any) {
          failedCount++;
          this.logger.error(
            `Failed to send practice reminder to account ${account.id}: ${error?.message ?? error}`,
          );

          const errCode = error?.code;
          if (
            errCode === "messaging/invalid-registration-token" ||
            errCode === "messaging/registration-token-not-registered"
          ) {
            invalidAccountIds.push(account.id);
          }
        }
      } else {
        // Firebase not initialized (e.g. dev/local environment)
        sentCount++;
      }
    }

    if (invalidAccountIds.length > 0) {
      this.logger.log(`Clearing ${invalidAccountIds.length} invalid FCM tokens from database.`);
      await this.accountRepo.update({ id: In(invalidAccountIds) }, { fcmId: undefined });
    }

    this.logger.log(
      `Daily practice reminder cron job complete. Total: ${accounts.length}, Sent: ${sentCount}, Failed: ${failedCount}`,
    );

    return {
      success: true,
      total: accounts.length,
      sent: sentCount,
      failed: failedCount,
    };
  }
}

