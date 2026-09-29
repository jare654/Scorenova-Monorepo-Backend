import {
  ForgotPasswordCommand,
  ResetPasswordCommand,
  UpdatePasswordCommandApp,
} from "../commands/auth.commands";
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ChangePasswordCommand,
  UpdatePasswordCommand,
  UserLoginCommand,
} from "@account/auth/commands/auth.commands";
import { AccountEntity } from "@account/models/accounts/account.entity";
import { Util } from "@libs/common/util";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { ResetPasswordTokenEntity } from "@account/models/reset-password/reset-password.entity";
import * as crypto from "crypto";
import { AccountQuery } from "@account/usecases/accounts/account.usecase.queries";
import { CollectionQuery } from "@libs/collection-query/collection-query";
import { AccountResponse } from "@account/usecases/accounts/account.response";
import { RoleRepository } from "@account/models/roles/role.repository";
import { SessionCommands } from "@account/usecases/sessions/session.usecase.commands";
import { AccountCommands } from "@account/usecases/accounts/account.usecase.commands";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(ResetPasswordTokenEntity)
    private readonly resetPasswordTokenRepository: Repository<ResetPasswordTokenEntity>,
    private readonly accountQuery: AccountQuery,
    private readonly accountCommand: AccountCommands,
    private readonly roleRepository: RoleRepository,
    private readonly sessionCommand: SessionCommands,
  ) {}
  async login(loginCommand: UserLoginCommand) {
    let account = await this.accountRepository.findOneBy({
      username: `${loginCommand.type.toLowerCase()}_${loginCommand.phoneNumber.toLowerCase()}`,
    });
    if (!account) {
      throw new BadRequestException(`Incorrect phone number or password`);
    }
    if (account.status !== "active") {
      throw new BadRequestException(
        `Complete registration before logging in.`,
      );
    }

    if (!(await Util.comparePassword(loginCommand.password, account.password))) {
      throw new BadRequestException(`Incorrect phone number or password`);
    }
    if (account.isActive === false || !account.isActive) {
      throw new BadRequestException(
        `Your account is not active, please contact us.`
      );
    }
    if (loginCommand.fcmId) {
      account.fcmId = loginCommand.fcmId;
      account = await this.accountRepository.save(account);
    }
    const q = new CollectionQuery();
    const accountRoles = await this.accountQuery.getRoles(account.id, q);
    const defaultAccountRole =
      accountRoles && accountRoles[0] ? accountRoles[0] : null;
    const permissions = defaultAccountRole
      ? await this.accountQuery.getPermissionsByAccountIdAndRoleId(
          account.id,
          defaultAccountRole.id,
          q
        )
      : [];
    const rolePayload = {
      id: "",
      name: "",
      key: "",
    };
    if (defaultAccountRole) {
      rolePayload.id = defaultAccountRole.id;
      rolePayload.name = defaultAccountRole.name;
      rolePayload.key = defaultAccountRole.key;
    }
    const permissionPayload = [];
    if (permissions.length > 0) {
      for (const permission of permissions) {
        permissionPayload.push(permission.key);
      }
    }
    const payload: UserInfo = {
      id: account.id,
      email: account?.email,
      name: account?.name,
      gender: account?.gender,
      type: account?.type,
      fcmId: account?.fcmId,
      // profileImage: account?.profileImage,
      address: account?.address,
      phoneNumber: account?.phoneNumber,
      role: { ...rolePayload },
      permissions: permissionPayload,
      isPremium: account?.isPremium ?? false,
      premiumEndDate: account?.premiumEndDate
        ? account.premiumEndDate.toISOString()
        : null,
    };
    const accessToken = Util.GenerateToken(payload, "30d");
    const refreshToken = Util.GenerateRefreshToken(payload);
    await this.sessionCommand.createSession({
      accountId: payload.id,
      token: accessToken,
      refreshToken,
    });
    return {
      accessToken,
      refreshToken,
      profile: {
        ...AccountResponse.fromEntity(account),
        roles: accountRoles,
        permissions,
        currentRole: { ...rolePayload },
      },
    };
  }
  async switchRole(roleId: string, currentUser: UserInfo) {
    const q = new CollectionQuery();
    const accountRole = await this.roleRepository.getById(roleId);
    const permissions = accountRole
      ? await this.accountQuery.getPermissionsByAccountIdAndRoleId(
          currentUser.id,
          roleId,
          q
        )
      : [];
    const rolePayload = {
      id: "",
      name: "",
      key: "",
    };
    if (accountRole) {
      rolePayload.id = accountRole.id;
      rolePayload.name = accountRole.name;
      rolePayload.key = accountRole.key;
    }
    const permissionPayload = [];
    if (permissions.length > 0) {
      for (const permission of permissions) {
        permissionPayload.push(permission.key);
      }
    }
    currentUser.permissions = permissionPayload;
    currentUser.role = { ...rolePayload };
    return {
      accessToken: Util.GenerateToken(currentUser, "30d"),
      refreshToken: Util.GenerateRefreshToken(currentUser),
      permissions,
      currentRole: { ...rolePayload },
    };
  }
  async changePassword(changePasswordCommand: ChangePasswordCommand) {
    const currentUser = changePasswordCommand.currentUser;
    const user = await this.accountRepository.findOneBy({
      id: currentUser.id,
    });
    if (!user) {
      throw new NotFoundException(`User not found`);
    }
    if (user.status !== "active") {
      throw new BadRequestException(`Complete registration before changing password.`);
    }

    if (!(await Util.comparePassword(
      changePasswordCommand.currentPassword,
      user.password
    ))) {
      throw new BadRequestException(`Incorrect old password`);
    }
    const nextPassword = await Util.hashPassword(changePasswordCommand.password);
    const result = await this.accountRepository.update(
      { id: user.id },
      { password: nextPassword },
    );
    return (result.affected ?? 0) > 0;
  }
  async updatePassword(updatePasswordCommand: UpdatePasswordCommand) {
    const user = await this.accountRepository.findOneBy({
      username: `${updatePasswordCommand.type.toLowerCase()}_${updatePasswordCommand.phoneNumber.toLowerCase()}`,
    });
    if (!user) {
      throw new NotFoundException(
        `User account not found with this phone number`
      );
    }
    if (user.status !== "active") {
      throw new BadRequestException(`Complete registration before changing password.`);
    }
    const nextPassword = await Util.hashPassword(updatePasswordCommand.password);
    const result = await this.accountRepository.update(
      { id: user.id },
      { password: nextPassword },
    );
    return (result.affected ?? 0) > 0;
  }
  async updatePasswordApp(updatePasswordCommand: UpdatePasswordCommandApp) {
    const user = await this.accountRepository.findOneBy({
      phoneNumber: updatePasswordCommand.phoneNumber,
    });
    if (!user) {
      throw new NotFoundException(
        `User account not found with this phone number`
      );
    }
    if (user.status !== "active") {
      throw new BadRequestException(`Complete registration before changing password.`);
    }
    const nextPassword = await Util.hashPassword(updatePasswordCommand.password);
    const result = await this.accountRepository.update(
      { id: user.id },
      { password: nextPassword },
    );
    return (result.affected ?? 0) > 0;
  }
  async forgotPassword(command: ForgotPasswordCommand) {
    const account = await this.accountRepository.findOneBy({
      phoneNumber: command.phoneNumber.toLowerCase(),
      type: command.type,
    });
    if (!account) {
      throw new BadRequestException(
        `User Account does not exist with email ${command.phoneNumber}`
      );
    }

    //delete the previous token
    await this.resetPasswordTokenRepository.delete({
      accountId: account.id,
    });
    const token = crypto.randomBytes(32).toString("hex");
    const resetPasswordTokenPayload = {
      accountId: account.id,
      email: account.email ?? command.phoneNumber.toLowerCase(),
      type: command.type,
      token: await Util.hashPassword(token),
    };
    const resetPasswordToken = await this.resetPasswordTokenRepository.save(
      resetPasswordTokenPayload
    );

    if (!resetPasswordToken) {
      throw new BadRequestException("Unknown error. Please try again.");
    }
    return true;
  }
  async resetPassword(command: ResetPasswordCommand) {
    const resetPassword = await this.resetPasswordTokenRepository.findOneBy({
      accountId: command.id,
    });
    if (!resetPassword) {
      throw new BadRequestException(`Invalid or expired password reset token`);
    }
    if (!(await Util.comparePassword(command.token, resetPassword.token))) {
      throw new BadRequestException(`Invalid or expired password reset token`);
    }
    const tokenExpiredAt = resetPassword.createdAt.getTime() + 60 * 60 * 1000;
    const currentTime = new Date().getTime();
    const d = currentTime - tokenExpiredAt;
    if (d >= 0) {
      throw new BadRequestException(`Invalid or expired password reset token`);
    }
    const account = await this.accountRepository.findOneBy({
      id: resetPassword.accountId,
    });
    if (!account) {
      throw new BadRequestException(`User Account does not exist`);
    }
    account.password = await Util.hashPassword(command.password);
    const result = await this.accountRepository.update(account.id, account);
    if (result) {
      //delete the token
      await this.resetPasswordTokenRepository.delete({
        accountId: account.id,
      });
      return true;
    }
    return false;
  }
  async resetUserPassword(command: ForgotPasswordCommand): Promise<boolean> {
    const account = await this.accountRepository.findOneBy({
      phoneNumber: command.phoneNumber,
      type: command.type,
    });
    if (!account) {
      throw new BadRequestException(
        `User Account does not exist with phone ${command.phoneNumber}`
      );
    }
    const newPassword = Util.generatePassword(8);
    account.password = await Util.hashPassword(newPassword);
    const result = await this.accountRepository.update(account.id, account);
    return !!result;
  }
}
