import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";
import { OtpEntity } from "@account/models/otp/otp.entity";
import { AccountEntity } from "@account/models/accounts/account.entity";
import { Util } from "@libs/common/util";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { AccountQuery } from "@account/usecases/accounts/account.usecase.queries";
import { SessionCommands } from "@account/usecases/sessions/session.usecase.commands";
import { CollectionQuery } from "@libs/collection-query/collection-query";
import { AccountResponse } from "@account/usecases/accounts/account.response";

const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(OtpEntity)
    private otpRepo: Repository<OtpEntity>,
    @InjectRepository(AccountEntity)
    private accountRepo: Repository<AccountEntity>,
    private accountQuery: AccountQuery,
    private sessionCommand: SessionCommands,
  ) {}

  async generate(phoneNumber: string): Promise<{ expiresAt: Date; otp: string }> {
    const normalized = Util.normalizePhone(phoneNumber);
    await this.otpRepo.delete({ phoneNumber: normalized });

    const code = this.generateCode(OTP_LENGTH);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.otpRepo.save(
      this.otpRepo.create({
        phoneNumber: normalized,
        otp: code,
        verificationId: `dev_${Date.now()}`,
        flowType: "registration",
        expiresAt,
      }),
    );

    console.log(
      `[OTP] ${normalized} => ${code} (expires ${expiresAt.toISOString()})`,
    );

    return { expiresAt, otp: code };
  }

  async verify(
    phoneNumber: string,
    code: string,
    type = "student",
  ): Promise<{
    verified: boolean;
    accessToken: string;
    refreshToken: string;
    profile: any;
  }> {
    const normalized = Util.normalizePhone(phoneNumber);
    const otp = await this.otpRepo.findOne({
      where: { phoneNumber: normalized },
      order: { createdAt: "DESC" },
    });

    if (!otp) {
      throw new BadRequestException("Invalid or expired OTP.");
    }
    if (otp.verified) {
      throw new BadRequestException("OTP already used.");
    }
    if (new Date() > otp.expiresAt) {
      throw new BadRequestException("OTP expired.");
    }
    if (otp.otp !== code.trim()) {
      throw new BadRequestException("Invalid OTP code.");
    }

    otp.verified = true;
    await this.otpRepo.save(otp);

    let account = await this.accountRepo.findOne({
      where: { phoneNumber: normalized },
    });

    if (!account) {
      account = await this.accountRepo.findOne({
        where: { phoneNumber: `0${normalized}` },
      });
    }

    if (!account) {
      account = await this.accountRepo.findOne({
        where: { phoneNumber: `251${normalized}` },
      });
    }

    if (!account) {
      account = await this.createUserFromPhone(normalized, type);
    }

    if (!account.isActive) {
      throw new BadRequestException(
        "Account is not active. Please contact support.",
      );
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
      verified: true,
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

  private generateCode(length: number): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  private async createUserFromPhone(
    phoneNumber: string,
    type: string,
  ): Promise<AccountEntity> {
    const normalized = Util.normalizePhone(phoneNumber);
    const id = crypto.randomUUID();
    const username = `${type.toLowerCase()}_${normalized}`;
    const tempPassword = Util.generatePassword(8);
    const account = this.accountRepo.create({
      id,
      name: normalized,
      phoneNumber: normalized,
      username,
      type,
      isActive: true,
      password: await Util.hashPassword(tempPassword),
      status: "active",
    });
    return this.accountRepo.save(account);
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
      fcmId: account?.fcmId,
      address: account?.address,
      phoneNumber: account?.phoneNumber,
      role: defaultRole
        ? { id: defaultRole.id, name: defaultRole.name, key: defaultRole.key }
        : { id: "", name: "", key: "" },
      permissions: permissions?.map((p) => p.key) ?? [],
    };
  }
}
