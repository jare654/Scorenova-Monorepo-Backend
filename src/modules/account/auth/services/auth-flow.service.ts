import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not } from "typeorm";
import * as crypto from "crypto";
import { OtpEntity } from "@account/models/otp/otp.entity";
import { AccountEntity } from "@account/models/accounts/account.entity";
import { Util } from "@libs/common/util";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { AccountQuery } from "@account/usecases/accounts/account.usecase.queries";
import { AccountCommands } from "@account/usecases/accounts/account.usecase.commands";
import { RoleRepository } from "@account/models/roles/role.repository";
import { SessionCommands } from "@account/usecases/sessions/session.usecase.commands";
import { CollectionQuery } from "@libs/collection-query/collection-query";
import { AccountResponse } from "@account/usecases/accounts/account.response";
import { CredentialType } from "@libs/common/enums";
import { sendOTP, verifyOTP } from "../helpers/otp-sender.helper";
import type {
  RegisterStepOneDto,
  VerifyOtpDto,
  RegisterSetPasswordDto,
  LoginDto,
  ForgotPasswordRequestDto,
  ForgotPasswordVerifyOtpDto,
  ForgotPasswordResetDto,
} from "../commands/auth.commands";
import { CreateAccountCommand } from "@account/usecases/accounts/account.commands";

const OTP_EXPIRY_MINUTES = 10;
const OTP_CODE_LENGTH = 6;  // must match OTP_LENGTH in auth.commands.ts
const REGISTRATION_FLOW = "registration";
const FORGOT_PASSWORD_FLOW = "forgot_password";

import { StreamEntity } from "../../../stream/models/streams/stream.entity";

@Injectable()
export class AuthFlowService {
  constructor(
    @InjectRepository(OtpEntity)
    private readonly otpRepo: Repository<OtpEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
    private readonly accountQuery: AccountQuery,
    private readonly accountCommand: AccountCommands,
    private readonly roleRepository: RoleRepository,
    private readonly sessionCommand: SessionCommands,
  ) { }

  async registerStepOne(data: RegisterStepOneDto): Promise<{ success: boolean; accountId: string }> {
    const phone = Util.normalizePhone(data.phoneNumber);

    // 1. Verify phone has a verified OTP
    const otpRecord = await this.otpRepo.findOne({
      where: { phoneNumber: phone, flowType: REGISTRATION_FLOW },
      order: { createdAt: "DESC" },
    });
    if (!otpRecord || !otpRecord.verified) {
      throw new BadRequestException("Please verify your phone number with OTP first.");
    }
    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException("OTP session expired. Please request a new OTP.");
    }

    // 2. Check if active account with this phone already exists
    const existingActive = await this.accountRepo.findOne({
      where: { phoneNumber: phone, status: "active" },
    });
    if (existingActive) {
      throw new BadRequestException("An account with this phone number already exists.");
    }

    // 3. Check email uniqueness against active accounts only
    if (data.email?.trim()) {
      const existingEmail = await this.accountRepo.findOne({
        where: { email: data.email.trim().toLowerCase(), status: "active" },
      });
      if (existingEmail) {
        throw new BadRequestException("An account with this email already exists.");
      }
    }

    let userType = data.userType ?? CredentialType.Student;
    let streamId = data.streamId;

    if (userType === "natural" || userType === "social") {
      const streamName = userType === "natural" ? "Natural Science" : "Social Science";
      const stream = await this.streamRepo.findOne({ where: { name: streamName } });
      if (stream) {
        streamId = stream.id;
      }
      userType = CredentialType.Student;
    }

    // 4. Save or update user profile directly in `accounts` table with status: "pending_password"
    let existingAccount = await this.accountRepo.findOne({
      where: { phoneNumber: phone },
    });

    if (existingAccount && existingAccount.status !== "active") {
      existingAccount.name = data.fullName;
      if (data.email?.trim()) existingAccount.email = data.email.trim().toLowerCase();
      if (data.gender) existingAccount.gender = data.gender;
      if (data.gradeId) existingAccount.gradeId = data.gradeId;
      if (streamId) existingAccount.streamId = streamId;
      if (data.fcmId) existingAccount.fcmId = data.fcmId;
      existingAccount.type = userType;
      existingAccount.status = "pending_password";
      existingAccount.otpVerified = true;
      existingAccount.isActive = false;
      if (data.address || data.city) {
        existingAccount.address = {
          city: data.city || (typeof data.address === "string" ? data.address : ""),
          woreda: existingAccount.address?.woreda || "",
          houseNumber: existingAccount.address?.houseNumber || "",
          commonName: existingAccount.address?.commonName || "",
          country: existingAccount.address?.country || "Ethiopia",
        };
      }
      const updated = await this.accountRepo.save(existingAccount);
      return { success: true, accountId: updated.id };
    }

    const accountId = crypto.randomUUID();
    const username = `${userType.toLowerCase()}_${phone}`;
    const newAccount = new AccountEntity();
    newAccount.id = accountId;
    newAccount.name = data.fullName;
    newAccount.email = data.email?.trim().toLowerCase() ?? "";
    newAccount.phoneNumber = phone;
    newAccount.username = username;
    newAccount.type = userType;
    newAccount.gender = data.gender ?? null;
    newAccount.gradeId = data.gradeId ?? null;
    newAccount.streamId = streamId ?? null;
    if (data.fcmId) newAccount.fcmId = data.fcmId;
    newAccount.status = "pending_password";
    newAccount.otpVerified = true;
    newAccount.isActive = false;
    newAccount.password = null;
    if (data.address || data.city) {
      newAccount.address = {
        city: data.city || (typeof data.address === "string" ? data.address : ""),
        woreda: "",
        houseNumber: "",
        commonName: "",
        country: "Ethiopia",
      };
    }

    const saved = await this.accountRepo.save(newAccount);
    return { success: true, accountId: saved.id };
  }

  async verifyOtp(data: VerifyOtpDto): Promise<{ verified: boolean; nextStep: string }> {
    const phone = Util.normalizePhone(data.phoneNumber);
    let otpRecord = await this.otpRepo.findOne({
      where: { phoneNumber: phone, flowType: REGISTRATION_FLOW },
      order: { createdAt: "DESC" },
    });
    if (!otpRecord) {
      otpRecord = await this.otpRepo.findOne({
        where: { phoneNumber: phone },
        order: { createdAt: "DESC" },
      });
    }
    if (!otpRecord) {
      throw new BadRequestException("Invalid or expired OTP.");
    }
    if (otpRecord.verified) {
      throw new BadRequestException("OTP already used.");
    }
    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException("OTP expired.");
    }
    if (!otpRecord.verificationId) {
      throw new BadRequestException("Invalid OTP session.");
    }
    const enteredOtp = (data.otp || data.code || "").trim();
    // When OTP was sent by provider and we don't have it stored, verify via provider only
    const isDevId = otpRecord.verificationId.startsWith("dev_");
    if (!otpRecord.otp && !isDevId) {
      await verifyOTP(phone, otpRecord.verificationId, enteredOtp);
    } else if (otpRecord.otp !== enteredOtp) {
      throw new BadRequestException("Invalid OTP code.");
    }
    otpRecord.verified = true;
    await this.otpRepo.save(otpRecord);

    // Determine resume point: check if an in-progress account exists for this phone
    const existingAccount = await this.accountRepo.findOne({
      where: { phoneNumber: phone },
    });

    // nextStep tells the mobile app which screen to go to after OTP success.
    const nextStep = existingAccount?.status === "pending_password"
      ? "set_password"
      : "personal_details";

    return { verified: true, nextStep };
  }

  async registerSetPassword(
    data: RegisterSetPasswordDto,
  ): Promise<{ accessToken: string; refreshToken: string; profile: any }> {
    const phone = Util.normalizePhone(data.phoneNumber);

    const account = await this.accountRepo.findOne({
      where: { phoneNumber: phone },
    });
    if (!account) {
      throw new BadRequestException("No registration details found. Please complete personal details first.");
    }

    if (account.status === "active" && account.password) {
      throw new BadRequestException("Account is already registered. Please log in.");
    }

    // Set hashed password and activate account in `accounts` table
    account.password = await Util.hashPassword(data.password);
    if (data.fcmId) account.fcmId = data.fcmId;
    account.status = "active";
    account.otpVerified = true;
    account.isActive = true;
    await this.accountRepo.save(account);

    // Clean up temporary OTP record
    await this.otpRepo.delete({ phoneNumber: phone, flowType: REGISTRATION_FLOW });

    const payload = await this.buildUserPayload(account);
    const accessToken = Util.GenerateToken(payload, "30d");
    const refreshToken = Util.GenerateRefreshToken(payload);
    await this.sessionCommand.createSession({
      accountId: payload.id,
      token: accessToken,
      refreshToken,
    });

    const q = new CollectionQuery();
    const accountRoles = await this.accountQuery.getRoles(account.id, q);
    const permissions = accountRoles?.[0]
      ? await this.accountQuery.getPermissionsByAccountIdAndRoleId(
        account.id,
        accountRoles[0].id,
        q,
      )
      : [];

    return {
      accessToken,
      refreshToken,
      profile: {
        ...AccountResponse.fromEntity(account),
        roles: accountRoles,
        permissions,
        currentRole: accountRoles?.[0]
          ? {
            id: accountRoles[0].id,
            name: accountRoles[0].name,
            key: accountRoles[0].key,
          }
          : { id: "", name: "", key: "" },
      },
    };
  }

  async login(data: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    profile: any;
  }> {
    const type = data.loginAs === "admin" ? CredentialType.Admin : CredentialType.Student;
    const phone = Util.normalizePhone(data.phoneNumber);
    const username = `${type}_${phone}`;
    let account = await this.accountRepo.findOneBy({ username });

    // Robust fallback for admins: try all phone number formats
    if (!account && type === CredentialType.Admin) {
      account = await this.accountRepo.findOne({
        where: { phoneNumber: phone, type: CredentialType.Admin },
      });
      if (!account) {
        account = await this.accountRepo.findOne({
          where: { phoneNumber: `0${phone}`, type: CredentialType.Admin },
        });
      }
      if (!account) {
        account = await this.accountRepo.findOne({
          where: { phoneNumber: `251${phone}`, type: CredentialType.Admin },
        });
      }
      if (!account) {
        account = await this.accountRepo.findOne({
          where: { phoneNumber: `+251${phone}`, type: CredentialType.Admin },
        });
      }
    }

    // Robust check for students: if the prefixed lookup fails, try finding by phone number in various formats
    if (!account && type === CredentialType.Student) {
      // 1. Try exactly as normalized (typically 9 digits)
      account = await this.accountRepo.findOne({
        where: { phoneNumber: phone, type: Not(CredentialType.Admin) },
      });

      // 2. Try with a leading zero (10 digits)
      if (!account) {
        account = await this.accountRepo.findOne({
          where: { phoneNumber: `0${phone}`, type: Not(CredentialType.Admin) },
        });
      }

      // 3. Try with country code (12 digits)
      if (!account) {
        account = await this.accountRepo.findOne({
          where: { phoneNumber: `251${phone}`, type: Not(CredentialType.Admin) },
        });
      }
    }

    if (!account) {
      throw new BadRequestException("Incorrect phone number or password.");
    }
    if (account.status !== "active" || !account.password) {
      throw new HttpException(
        {
          statusCode: 423,
          message: "Registration is incomplete. Please set your password to complete registration.",
          error: "Locked",
          nextStep: account.status === "pending_password" ? "set_password" : "personal_details",
        },
        HttpStatus.LOCKED,
      );
    }
    if (!account.otpVerified) {
      throw new BadRequestException(
        "Account not verified. Complete OTP verification first.",
      );
    }
    if (!(await Util.comparePassword(data.password, account.password))) {
      throw new BadRequestException("Incorrect phone number or password.");
    }
    if (!account.isActive) {
      throw new BadRequestException("Your account is not active. Please contact support.");
    }
    if (data.fcmId) {
      account.fcmId = data.fcmId;
      await this.accountRepo.save(account);
    }

    const payload = await this.buildUserPayload(account);
    const accessToken = Util.GenerateToken(payload, "30d");
    const refreshToken = Util.GenerateRefreshToken(payload);
    await this.sessionCommand.createSession({
      accountId: payload.id,
      token: accessToken,
      refreshToken,
    });

    const q = new CollectionQuery();
    const accountRoles = await this.accountQuery.getRoles(account.id, q);
    const permissions = accountRoles?.[0]
      ? await this.accountQuery.getPermissionsByAccountIdAndRoleId(
        account.id,
        accountRoles[0].id,
        q,
      )
      : [];

    return {
      accessToken,
      refreshToken,
      profile: {
        ...AccountResponse.fromEntity(account),
        roles: accountRoles,
        permissions,
        currentRole: accountRoles?.[0]
          ? {
            id: accountRoles[0].id,
            name: accountRoles[0].name,
            key: accountRoles[0].key,
          }
          : { id: "", name: "", key: "" },
      },
    };
  }

  async forgotPassword(data: ForgotPasswordRequestDto): Promise<{ success: boolean; otp?: string }> {
    const phone = Util.normalizePhone(data.phoneNumber);
    const account = await this.accountRepo.findOne({
      where: { phoneNumber: phone },
    });
    if (!account) {
      throw new NotFoundException("No account found with this phone number.");
    }
    if (account.type === CredentialType.Admin) {
      throw new BadRequestException("Use admin reset flow for admin accounts.");
    }
    // Only delete previous FORGOT_PASSWORD flow OTPs — never touch registration records
    await this.otpRepo.delete({ phoneNumber: phone, flowType: FORGOT_PASSWORD_FLOW });

    const result = await sendOTP(phone, OTP_CODE_LENGTH, 0);
    const storedOtp =
      result.otp ||
      (result.verificationId && !result.verificationId.startsWith("dev_")
        ? ""
        : this.generateCode(OTP_CODE_LENGTH));
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.otpRepo.save(
      this.otpRepo.create({
        phoneNumber: phone,
        otp: storedOtp,
        verificationId: result.verificationId,
        flowType: FORGOT_PASSWORD_FLOW,
        expiresAt,
      }),
    );
    return { success: true, otp: storedOtp };
  }

  async forgotPasswordVerifyOtp(
    data: ForgotPasswordVerifyOtpDto,
  ): Promise<{ verified: boolean }> {
    const phone = Util.normalizePhone(data.phoneNumber);
    const otpRecord = await this.otpRepo.findOne({
      where: { phoneNumber: phone, flowType: FORGOT_PASSWORD_FLOW },
      order: { createdAt: "DESC" },
    });
    if (!otpRecord) {
      throw new BadRequestException("Invalid or expired OTP.");
    }
    if (otpRecord.verified) {
      throw new BadRequestException("OTP already used.");
    }
    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException("OTP expired.");
    }
    if (!otpRecord.verificationId) {
      throw new BadRequestException("Invalid OTP session.");
    }
    const isDevId = otpRecord.verificationId.startsWith("dev_");
    if (!otpRecord.otp && !isDevId) {
      // Provider-only verification
      await verifyOTP(phone, otpRecord.verificationId, data.otp.trim());
    } else if (otpRecord.otp !== data.otp.trim()) {
      throw new BadRequestException("Invalid OTP code.");
    }
    // Code matched against DB — no need to call provider again
    otpRecord.verified = true;
    await this.otpRepo.save(otpRecord);
    return { verified: true };
  }

  async forgotPasswordReset(data: ForgotPasswordResetDto): Promise<{ success: boolean }> {
    const phone = Util.normalizePhone(data.phoneNumber);
    const otpRecord = await this.otpRepo.findOne({
      where: { phoneNumber: phone, flowType: FORGOT_PASSWORD_FLOW },
      order: { createdAt: "DESC" },
    });
    if (!otpRecord || !otpRecord.verified) {
      throw new BadRequestException("Complete OTP verification first.");
    }

    const account = await this.accountRepo.findOne({
      where: { phoneNumber: phone },
    });
    if (!account) {
      throw new NotFoundException("No account found with this phone number.");
    }
    if (account.type === CredentialType.Admin) {
      throw new BadRequestException("Use admin reset flow for admin accounts.");
    }

    account.password = await Util.hashPassword(data.password);
    account.otpVerified = true;
    await this.accountRepo.save(account);
    await this.otpRepo.delete({ id: otpRecord.id });
    return { success: true };
  }

  async checkPhone(phoneNumber: string): Promise<{ isRegistered: boolean; phoneNumber: string }> {
    const phone = Util.normalizePhone(phoneNumber);
    const account = await this.accountRepo.findOne({
      where: { phoneNumber: phone },
    });
    return {
      isRegistered: !!account,
      phoneNumber: phone,
    };
  }

  /**
   * Fixes accounts with a broken password hash caused by BcryptHashRound=NaN.
   * A hash is considered broken if it doesn't start with "$2" (not a valid bcrypt hash).
   * The user must provide their phone number and the new desired password.
   * This endpoint only works if the stored hash is provably invalid.
   */
  async fixBrokenPassword(phoneNumber: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const phone = Util.normalizePhone(phoneNumber);

    // Try all format variants
    const account = await this.accountRepo.findOne({ where: { phoneNumber: phone } })
      ?? await this.accountRepo.findOne({ where: { phoneNumber: `0${phone}` } })
      ?? await this.accountRepo.findOne({ where: { phoneNumber: `251${phone}` } });

    if (!account) {
      throw new BadRequestException("Account not found.");
    }

    // Only allow this fix if the stored hash is genuinely broken (not a valid bcrypt hash)
    const isHashBroken = !account.password || !account.password.startsWith("$2");
    if (!isHashBroken) {
      throw new BadRequestException(
        "Password hash is valid. Use the forgot-password flow to reset your password.",
      );
    }

    account.password = await Util.hashPassword(newPassword);
    await this.accountRepo.save(account);

    return { success: true, message: "Password has been fixed. You can now log in." };
  }


  private normalizePhone(phone: string): string {
    return Util.normalizePhone(phone);
  }

  private async ensurePhoneAndEmailUnique(phone: string, email?: string): Promise<void> {
    const existingByPhone = await this.accountRepo.findOne({
      where: { phoneNumber: phone },
    });
    // If account exists, only block if it's already OTP verified.
    // This allows "bare" accounts (created by general OTP verify) to be completed.
    if (existingByPhone && existingByPhone.otpVerified) {
      throw new BadRequestException("An account with this phone number already exists.");
    }
    if (email?.trim()) {
      const existingByEmail = await this.accountRepo.findOne({
        where: { email: email.trim().toLowerCase() },
      });
      if (existingByEmail) {
        throw new BadRequestException("An account with this email already exists.");
      }
    }
  }

  private generateCode(length: number): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  private async buildUserPayload(account: AccountEntity): Promise<UserInfo> {
    const q = new CollectionQuery();
    const accountRoles = await this.accountQuery.getRoles(account.id, q);
    const defaultRole = accountRoles?.[0] ?? null;
    const permissions = defaultRole
      ? await this.accountQuery.getPermissionsByAccountIdAndRoleId(
        account.id,
        defaultRole.id,
        q,
      )
      : [];
    return {
      id: account.id,
      email: account?.email,
      name: account?.name,
      gender: account?.gender,
      type: account?.type,
      gradeId: account?.gradeId ?? null,
      streamId: account?.streamId ?? null,
      fcmId: account?.fcmId,
      address: account?.address,
      phoneNumber: account?.phoneNumber,
      isPremium: account?.isPremium ?? false,
      premiumEndDate: account?.premiumEndDate
        ? account.premiumEndDate.toISOString()
        : null,
      role: defaultRole
        ? { id: defaultRole.id, name: defaultRole.name, key: defaultRole.key }
        : { id: "", name: "", key: "" },
      permissions: permissions?.map((p) => p.key) ?? [],
    };
  }
}
