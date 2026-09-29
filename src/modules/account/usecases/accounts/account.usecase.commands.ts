import {
  CreateAccountCommand,
  CreateAdminCommand,
  UpdateAccountCommand,
} from "./account.commands";
import { AccountRepository } from "@account/models/accounts/account.repository";
import { AccountResponse } from "./account.response";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  ArchiveAccountRoleCommand,
  CreateAccountRoleCommand,
  CreateAccountRolesCommand,
  DeleteAccountRoleCommand,
  UpdateAccountRoleCommand,
} from "./account-role.commands";
import { AccountRoleResponse } from "./account-role.response";
import { AccountRoleEntity } from "@account/models/accounts/account-role.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AccountPermissionEntity } from "@account/models/accounts/account-permission.entity";
import { AccountPermissionResponse } from "./account-permission.response";
import {
  AddAccountPermissionsCommand,
  ArchiveAccountPermissionCommand,
  CreateAccountPermissionCommand,
  DeleteAccountPermissionCommand,
  UpdateAccountPermissionCommand,
} from "./account-permission.commands";
import { RoleQueries } from "../roles/role.usecase.queries";
import { CollectionQuery } from "@libs/collection-query/collection-query";
import { FilterOperators } from "@libs/collection-query/filter_operators";
import { RoleResponse } from "../roles/role.response";
import { NotificationService } from "../../../notification/notification.service";
import { PermissionResponse } from "../permissions/permission.response";
import { PermissionQueries } from "../permissions/permission.usecase.queries";
import { CredentialType, Tables } from "@libs/common/enums";
import { RoleRepository } from "@account/models/roles/role.repository";
import { v4 as uuidv4 } from "uuid";
import { Util } from "@libs/common/util";
import { RoleEntity } from "@account/models/roles/role.entity";

@Injectable()
export class AccountCommands {
  constructor(
    private accountRepository: AccountRepository,
    @InjectRepository(AccountRoleEntity)
    private accountRoleRepository: Repository<AccountRoleEntity>,
    @InjectRepository(AccountPermissionEntity)
    private accountPermissionRepository: Repository<AccountPermissionEntity>,
    private roleQueries: RoleQueries,
    private roleRepository: RoleRepository,
    private permissionQueries: PermissionQueries,
    private notificationService: NotificationService,
  ) {}
  async createAccount(command: CreateAccountCommand): Promise<AccountResponse> {
    const accountDomain = CreateAccountCommand.fromCommand(command);

    // Try to find existing account by username OR phone number (in various formats)
    let existingAccount = await this.accountRepository.getOneBy(
      "username",
      accountDomain.username,
      [],
      true,
    );

    if (!existingAccount) {
      existingAccount = await this.accountRepository.getOneBy(
        "phoneNumber",
        accountDomain.phoneNumber,
        [],
        true,
      );
    }

    if (!existingAccount) {
      existingAccount = await this.accountRepository.getOneBy(
        "phoneNumber",
        `0${accountDomain.phoneNumber}`,
        [],
        true,
      );
    }

    if (!existingAccount) {
      existingAccount = await this.accountRepository.getOneBy(
        "phoneNumber",
        `251${accountDomain.phoneNumber}`,
        [],
        true,
      );
    }

    if (!existingAccount) {
      const account = await this.accountRepository.insert(accountDomain);
        if (account.type !== CredentialType.Admin && account.status === "active") {
        let role = await this.roleRepository.getOneBy("key", account.type);
        if (!role) {
          const roleName = `${account.type[0].toUpperCase()}${account.type.slice(
            1,
            account.type.length,
          )}`;
          role = await this.roleRepository.insert({
            name: roleName,
            key: account.type,
            protected: true,
          } as RoleEntity);
        }
        const accountRoleCommand: CreateAccountRolesCommand = {
          accountId: account.id,
          roles: [role.id],
        };
        await this.seedAccountRole(accountRoleCommand);
      }
      return AccountResponse.fromEntity(account);
    } else {
      // Update existing account with new info
      // This handles "bare" accounts from OTP verify as well as re-registrations
      existingAccount.name = accountDomain.name;
      existingAccount.email = accountDomain.email;
      existingAccount.password = accountDomain.password;
      existingAccount.phoneNumber = accountDomain.phoneNumber; // Standardize phone number format
      existingAccount.username = accountDomain.username; // Normalize username prefix
      existingAccount.type = accountDomain.type;
      existingAccount.gender = accountDomain.gender;
      existingAccount.gradeId = accountDomain.gradeId;
      existingAccount.streamId = accountDomain.streamId;
      existingAccount.otpVerified = true;
        existingAccount.status = accountDomain.status ?? existingAccount.status;
      await this.accountRepository.update(existingAccount.id, existingAccount);
      return AccountResponse.fromEntity(existingAccount);
    }
  }

  async createAdmin(command: CreateAdminCommand): Promise<AccountResponse> {
    const phoneNumber = command.phoneNumber.replace(/\D/g, "").trim();
    const createCommand: CreateAccountCommand = {
      accountId: uuidv4(),
      name: command.name,
      email: command.email ?? "",
      phoneNumber,
      type: CredentialType.Admin,
      isActive: true,
      password: await Util.hashPassword(command.password),
      otpVerified: true,
        status: "active",
    };

    const account = await this.createAccount(createCommand);

    if (command.roleIds?.length) {
      await this.addAccountRole({
        accountId: account.id,
        roles: command.roleIds,
      });
    }

    if (command.permissionIds?.length) {
      const roleId = command.permissionRoleId ?? command.roleIds?.[0];
      if (!roleId) {
        throw new BadRequestException(
          "permissionRoleId is required when permissionIds are provided",
        );
      }
      await this.addAccountPermission({
        accountId: account.id,
        permissions: command.permissionIds,
        roleId,
      } as AddAccountPermissionsCommand);
    }

    return account;
  }
  @OnEvent("update.account")
  async updateAccount(command: UpdateAccountCommand): Promise<AccountResponse> {
    const accountDomain = await this.accountRepository.getById(
      command.accountId,
    );
    if (accountDomain) {
      accountDomain.name = command.name;
      if (command.email !== undefined) {
        accountDomain.email = command.email?.toLowerCase() ?? "";
      }
      accountDomain.phoneNumber = command.phoneNumber;
      accountDomain.username = `${accountDomain.type.toLowerCase()}_${command.phoneNumber.toLowerCase()}`;
      accountDomain.gender = command.gender;
      accountDomain.address = command.address;
      accountDomain.profileImageFilename = command.profileImageFilename
        ? command.profileImageFilename
        : accountDomain.profileImageFilename;
      accountDomain.gradeId =
        command.gradeId !== undefined ? command.gradeId : accountDomain.gradeId;
      accountDomain.streamId =
        command.streamId !== undefined
          ? command.streamId
          : accountDomain.streamId;
      accountDomain.isPremium =
        command.isPremium !== undefined
          ? command.isPremium
          : accountDomain.isPremium;
      accountDomain.isActive =
        command.isActive !== undefined
          ? command.isActive
          : accountDomain.isActive;
      const account = await this.accountRepository.update(
        accountDomain.id,
        accountDomain,
      );
      return AccountResponse.fromEntity(account);
    }
    return null;
  }
  async archiveAccount(id: string): Promise<boolean> {
    const accountDomain = await this.accountRepository.getById(id);
    if (!accountDomain) {
      throw new NotFoundException(`Account not found`);
    }
    return await this.accountRepository.archive(id);
  }
  async restoreAccount(id: string): Promise<AccountResponse> {
    const accountDomain = await this.accountRepository.getById(id, [], true);
    if (!accountDomain) {
      throw new NotFoundException(`Account not found`);
    }
    const r = await this.accountRepository.restore(id);
    if (r) {
      accountDomain.deletedAt = null;
    }
    return AccountResponse.fromEntity(accountDomain);
  }
  async deleteAccount(id: string): Promise<boolean> {
    const accountDomain = await this.accountRepository.getById(id);
    if (!accountDomain) {
      throw new NotFoundException(`Account not found`);
    }
    return await this.accountRepository.delete(id);
  }
  @OnEvent("account.deleted")
  async handleDeleteAccount(command: { phoneNumber: string; id: string }) {
    const existingAccount = await this.accountRepository.getById(
      command.id,
      [],
      true,
    );
    if (existingAccount) {
      await this.accountRepository.delete(existingAccount.id);
    }
  }
  @OnEvent("account.archived")
  async handleArchiveAccount(command: { phoneNumber: string; id: string }) {
    const account = await this.accountRepository.getById(command.id, [], true);
    if (account) {
      account.deletedAt = new Date();
      await this.accountRepository.update(account.id, account);
    }
  }
  @OnEvent("account.restored")
  async handleRestoreAccount(command: { phoneNumber: string; id: string }) {
    const account = await this.accountRepository.getById(command.id, [], true);
    if (account) {
      account.deletedAt = null;
      account.deletedBy = null;
      await this.accountRepository.update(account.id, account);
    }
  }
  @OnEvent("account.activate-or-block")
  async activateOrBlockAccount(command: { phoneNumber: string; id: string }) {
    const account = await this.accountRepository.getById(command.id, [], true);
    if (account) {
      account.isActive = !account.isActive;
      const status = await this.accountRepository.update(account.id, account);
    }
  }
  async sendAccountCredentials(id: string) {
    const account = await this.accountRepository.getById(id, [], true);
    if (account) {
      const password = Util.generatePassword(8);
      account.password = await Util.hashPassword(password);
      await this.accountRepository.update(account.id, account);
      return true;
    }
    return false;
  }
  async togglePremium(id: string): Promise<boolean> {
    const account = await this.accountRepository.getById(id, [], true);
    if (account) {
      account.isPremium = !account.isPremium;
      await this.accountRepository.update(account.id, account);

      if (account.isPremium) {
        this.notificationService
          .sendToUser(
            account.id,
            "Payment Approved & Premium Access Granted 🎉",
            "Your payment has been approved! All premium subjects, practice questions, and mock exams are now unlocked.",
            account.fcmId ?? undefined,
          )
          .catch(() => {
            /* non-critical */
          });
      }
      return true;
    }
    throw new NotFoundException("Account not found");
  }

  async grantPremiumWithDates(
    id: string,
    startDate: string,
    endDate: string,
    plan: string,
  ): Promise<boolean> {
    const account = await this.accountRepository.getById(id, [], true);
    if (!account) throw new NotFoundException("Account not found");
    account.isPremium = true;
    account.premiumStartDate = new Date(startDate);
    account.premiumEndDate = new Date(endDate);
    account.premiumPlan = plan;
    await this.accountRepository.update(account.id, account);

    const formattedDate = new Date(endDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    // Notify the user via push + inbox notification
    this.notificationService
      .sendToUser(
        account.id,
        "Payment Approved & Premium Access Granted 🎉",
        `Your ${plan || "premium"} subscription plan is now active until ${formattedDate}. Enjoy full access to all subjects, practice questions, and mock exams!`,
        account.fcmId ?? undefined,
      )
      .catch(() => {
        /* non-critical */
      });

    return true;
  }

  async grantPremiumByPhoneNumber(
    phoneNumber: string,
    years?: number,
    durationDays?: number,
    plan?: string,
  ): Promise<{ success: boolean; message: string; updatedCount: number }> {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    const suffix = cleanPhone.length >= 9 ? cleanPhone.slice(-9) : cleanPhone;
    const startDate = new Date();
    const endDate = new Date();

    if (durationDays && durationDays > 0) {
      endDate.setDate(endDate.getDate() + durationDays);
    } else {
      const y = years || 1;
      endDate.setFullYear(endDate.getFullYear() + y);
    }

    const resolvedPlan =
      plan ||
      (durationDays
        ? durationDays <= 31
          ? "Monthly"
          : durationDays <= 93
          ? "Quarterly"
          : durationDays <= 185
          ? "Half-Year"
          : "Annual"
        : "Yearly");

    const accounts = await this.accountRepository.findByPhoneSuffix(suffix);

    for (const acc of accounts) {
      acc.isPremium = true;
      acc.premiumPlan = resolvedPlan;
      acc.premiumStartDate = startDate;
      acc.premiumEndDate = endDate;
      await this.accountRepository.update(acc.id, acc);

      const formattedDate = endDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      this.notificationService
        .sendToUser(
          acc.id,
          "Payment Approved & Premium Access Granted 🎉",
          `Your ${resolvedPlan} subscription has been approved! Premium access is now active until ${formattedDate}. Enjoy full access to all subjects, practice questions, and mock exams!`,
          acc.fcmId ?? undefined,
        )
        .catch(() => {
          /* non-critical */
        });
    }

    if (accounts.length === 0) {
      return {
        success: false,
        message: `No account found with phone number ending in ${suffix}`,
        updatedCount: 0,
      };
    }

    return {
      success: true,
      message: `Premium granted (${resolvedPlan}) to ${accounts.length} account(s) matching ${suffix}`,
      updatedCount: accounts.length,
    };
  }

  async revokePremium(id: string): Promise<boolean> {
    const account = await this.accountRepository.getById(id, [], true);
    if (!account) throw new NotFoundException("Account not found");
    account.isPremium = false;
    account.premiumStartDate = null;
    account.premiumEndDate = null;
    account.premiumPlan = null;
    await this.accountRepository.update(account.id, account);

    // Notify the user
    this.notificationService
      .sendToUser(
        account.id,
        "Premium Access Removed",
        "Your premium subscription has been revoked. Upgrade again to regain access.",
        account.fcmId ?? undefined,
      )
      .catch(() => {
        /* non-critical */
      });

    return true;
  }

  async extendPremium(id: string, endDate: string): Promise<boolean> {
    const account = await this.accountRepository.getById(id, [], true);
    if (!account) throw new NotFoundException("Account not found");
    account.premiumEndDate = new Date(endDate);
    await this.accountRepository.update(account.id, account);

    const formattedDate = new Date(endDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    // Notify the user
    this.notificationService
      .sendToUser(
        account.id,
        "Subscription Extended 🎉",
        `Your premium subscription has been extended until ${formattedDate}.`,
        account.fcmId ?? undefined,
      )
      .catch(() => {
        /* non-critical */
      });

    return true;
  }

  async getPremiumUsers(): Promise<any[]> {
    const accounts = await this.accountRepository.getAllBy(
      "isPremium",
      true,
      [],
      false,
    );
    if (!accounts || accounts.length === 0) return [];
    return accounts.map((a: any) => ({
      id: a.id,
      name: a.name,
      phoneNumber: a.phoneNumber,
      premiumPlan: a.premiumPlan ?? "Monthly",
      premiumStartDate: a.premiumStartDate,
      premiumEndDate: a.premiumEndDate,
      isActive: a.isActive,
      status:
        a.premiumEndDate && new Date(a.premiumEndDate) < new Date()
          ? "Expired"
          : "Active",
    }));
  }
  async resetUserPassword(id: string): Promise<{ password?: string }> {
    const account = await this.accountRepository.getById(id, [], true);
    if (account) {
      const newPassword = Util.generatePassword(8);
      account.password = await Util.hashPassword(newPassword);
      await this.accountRepository.update(account.id, account);
      return { password: newPassword };
    }
    throw new NotFoundException("Account not found");
  }
  async removeFcmId(id: string) {
    const account = await this.accountRepository.getById(id, [], true);
    if (account) {
      account.fcmId = null;
      const status = await this.accountRepository.update(account.id, account);
    }
  }
  async createDefaultSupperAdminAccount(data: any) {
    try {
      const command: CreateAccountCommand = {
        accountId: uuidv4(),
        email: "admin@examapp.com",
        type: CredentialType.Admin,
        name: "Super Admin",
        isActive: true,
        password: await Util.hashPassword("12345678"),
        phoneNumber: "+251913922700",
        gender: "male",
      };
      const accountDomain = CreateAccountCommand.fromCommand(command);
      const superAccount = await this.accountRepository.insert(accountDomain);
      const accountRoleCommand: CreateAccountRolesCommand = {
        accountId: superAccount.id,
        roles: [data.roleId],
      };
      await this.seedAccountRole(accountRoleCommand);
    } catch (error) {}
  }
  //Account Role
  async addAccountRole(
    command: CreateAccountRolesCommand,
  ): Promise<RoleResponse[]> {
    const accountDomain = await this.accountRepository.getById(
      command.accountId,
    );
    if (!accountDomain) {
      throw new NotFoundException(`Account not found.`);
    }
    accountDomain.accountRoles = [];
    for (const roleId of command.roles) {
      const accountRole = CreateAccountRoleCommand.fromCommand({
        roleId: roleId,
        accountId: command.accountId,
      });
      accountDomain.addAccountRole(accountRole);
      const permissionQuery = new CollectionQuery();
      permissionQuery.filter = [];
      permissionQuery.filter.push([
        {
          field: "roleId",
          operator: FilterOperators.EqualTo,
          value: roleId,
        },
      ]);
      const permissions =
        await this.roleQueries.getRolePermissions(permissionQuery);
      const accountPermissionsCommand = new AddAccountPermissionsCommand();
      accountPermissionsCommand.roleId = roleId;
      accountPermissionsCommand.accountId = command.accountId;
      accountPermissionsCommand.permissions = permissions.data.map(
        (permission) => {
          return permission.permissionId;
        },
      );
      await this.addAccountPermission(accountPermissionsCommand);
    }
    const result = await this.accountRepository.save(accountDomain);
    if (!result) return null;
    if (result.accountRoles.length === 0) return [];
    const roleIds = result.accountRoles.map((role) => role.roleId);

    const query = new CollectionQuery();
    query.filter = [
      [
        {
          field: "id",
          operator: FilterOperators.In,
          value: roleIds.join(","),
        },
      ],
    ];
    const permissionResponseData = await this.roleQueries.getRoles(query);
    return permissionResponseData.data;
  }
  async seedAccountRole(
    command: CreateAccountRolesCommand,
  ): Promise<AccountResponse> {
    const accountDomain = await this.accountRepository.getById(
      command.accountId,
      [Tables.AccountRoles],
    );
    if (accountDomain) {
      accountDomain.accountRoles = [];
      for (const roleId of command.roles) {
        const accountRole = CreateAccountRoleCommand.fromCommand({
          roleId: roleId,
          accountId: command.accountId,
        });
        accountDomain.addAccountRole(accountRole);
        const permissionQuery = new CollectionQuery();
        permissionQuery.filter = [];
        permissionQuery.filter.push([
          {
            field: "roleId",
            operator: FilterOperators.EqualTo,
            value: roleId,
          },
        ]);
        const permissions =
          await this.roleQueries.getRolePermissions(permissionQuery);
        const accountPermissionsCommand = new AddAccountPermissionsCommand();
        accountPermissionsCommand.roleId = roleId;
        accountPermissionsCommand.accountId = command.accountId;
        accountPermissionsCommand.permissions = permissions.data.map(
          (permission) => {
            return permission.permissionId;
          },
        );
        await this.addAccountPermission(accountPermissionsCommand);
      }
      const result = await this.accountRepository.save(accountDomain);
      return AccountResponse.fromEntity(result);
    }
    return null;
  }
  async updateAccountRole(
    command: UpdateAccountRoleCommand,
  ): Promise<AccountRoleResponse> {
    const accountDomain = await this.accountRepository.getById(
      command.accountId,
    );
    if (!accountDomain) {
      throw new NotFoundException(`Account not found.`);
    }
    const oldPayload = accountDomain.accountRoles.find(
      (b) => b.id === command.id,
    );
    if (oldPayload) {
      throw new BadRequestException(`Role already assigned to this account`);
    }

    const accountRole = UpdateAccountRoleCommand.fromCommand(command);
    accountDomain.updateAccountRole(accountRole);
    const result = await this.accountRepository.update(
      accountDomain.id,
      accountDomain,
    );
    if (!result) return null;

    const response = AccountRoleResponse.fromEntity(
      result.accountRoles.find((accountRole) => accountRole.id === command.id),
    );
    return response;
  }
  async deleteAccountRole(command: DeleteAccountRoleCommand): Promise<boolean> {
    const accountRole = await this.accountRoleRepository.findOne({
      where: { roleId: command.roleId, accountId: command.accountId },
      withDeleted: true,
    });
    if (!accountRole) {
      throw new NotFoundException(`Account role not found`);
    }
    const result = await this.accountRoleRepository.delete({
      id: accountRole.id,
    });
    return result ? true : false;
  }
  async archiveAccountRole(
    command: ArchiveAccountRoleCommand,
  ): Promise<boolean> {
    const accountDomain = await this.accountRepository.getById(
      command.accountId,
    );
    if (!accountDomain) {
      throw new NotFoundException(`Account not found.`);
    }
    const accountRole = accountDomain.accountRoles.find(
      (accountRole) => accountRole.id === command.id,
    );
    accountRole.deletedAt = new Date();
    accountRole.deletedBy = command.currentUser.id;
    accountRole.archiveReason = command.reason;
    accountDomain.updateAccountRole(accountRole);
    const result = await this.accountRepository.update(
      accountDomain.id,
      accountDomain,
    );

    return result ? true : false;
  }
  async restoreAccountRole(
    command: DeleteAccountRoleCommand,
  ): Promise<AccountRoleResponse> {
    const accountRole = await this.accountRoleRepository.findOne({
      where: { roleId: command.roleId, accountId: command.accountId },
      withDeleted: true,
    });
    if (!accountRole) {
      throw new NotFoundException(`Account role not found`);
    }
    accountRole.deletedAt = null;
    const result = await this.accountRoleRepository.save(accountRole);
    return AccountRoleResponse.fromEntity(result);
  }

  //Account Permission
  async addAccountPermission(
    command: AddAccountPermissionsCommand,
  ): Promise<PermissionResponse[]> {
    const accountDomain = await this.accountRepository.getById(
      command.accountId,
      [Tables.AccountPermissions],
    );
    if (!accountDomain) {
      throw new NotFoundException(`Account not found.`);
    }
    for (const permissionId of command.permissions) {
      const isExist = accountDomain.accountPermissions.find(
        (accountPermission) => accountPermission.permissionId === permissionId,
      );
      if (!isExist) {
        const accountPermission = CreateAccountPermissionCommand.fromCommand({
          permissionId: permissionId,
          accountId: command.accountId,
          roleId: command.roleId,
        });
        accountDomain.addAccountPermission(accountPermission);
      }
    }
    let newPermissions: AccountPermissionEntity[];
    newPermissions = accountDomain.accountPermissions.filter(
      (accountPermission) => {
        return command.permissions.includes(accountPermission.permissionId);
      },
    );
    accountDomain.accountPermissions = newPermissions;
    const result = await this.accountRepository.save(accountDomain);

    if (!result) return null;

    if (result.accountPermissions.length === 0) return [];
    const accountPermissions = result.accountPermissions.map(
      (accountPermission) => accountPermission.permissionId,
    );
    const query = new CollectionQuery();
    query.filter = [];
    query.filter.push([
      {
        field: "id",
        operator: FilterOperators.In,
        value: accountPermissions.join(","),
      },
    ]);
    const permissionResponseData =
      await this.permissionQueries.getPermissions(query);
    return permissionResponseData.data;
  }
  async updateAccountPermission(
    command: UpdateAccountPermissionCommand,
  ): Promise<AccountPermissionResponse> {
    const accountDomain = await this.accountRepository.getById(
      command.accountId,
    );
    if (!accountDomain) {
      throw new NotFoundException(`Account not found.`);
    }
    const oldPayload = accountDomain.accountPermissions.find(
      (b) => b.id === command.id,
    );
    if (oldPayload) {
      throw new BadRequestException(
        `Permission already assigned to this account`,
      );
    }

    const accountPermission =
      UpdateAccountPermissionCommand.fromCommand(command);
    accountDomain.updateAccountPermission(accountPermission);
    const result = await this.accountRepository.update(
      accountDomain.id,
      accountDomain,
    );
    if (!result) return null;

    const response = AccountPermissionResponse.fromEntity(
      result.accountPermissions.find(
        (accountPermission) => accountPermission.id === command.id,
      ),
    );
    return response;
  }
  async deleteAccountPermission(
    command: DeleteAccountPermissionCommand,
  ): Promise<boolean> {
    const accountPermission = await this.accountPermissionRepository.find({
      where: { id: command.id },
      withDeleted: true,
    });
    if (!accountPermission[0]) {
      throw new NotFoundException(`Account permission not found`);
    }
    const result = await this.accountPermissionRepository.delete({
      id: command.id,
    });
    return result ? true : false;
  }
  async archiveAccountPermission(
    command: ArchiveAccountPermissionCommand,
  ): Promise<boolean> {
    const accountDomain = await this.accountRepository.getById(
      command.accountId,
    );
    if (!accountDomain) {
      throw new NotFoundException(` Account not found.`);
    }
    const accountPermission = accountDomain.accountPermissions.find(
      (accountPermission) => accountPermission.id === command.id,
    );
    accountPermission.deletedAt = new Date();
    accountPermission.deletedBy = command.currentUser.id;
    accountPermission.archiveReason = command.reason;
    accountDomain.updateAccountPermission(accountPermission);
    const result = await this.accountRepository.update(
      accountDomain.id,
      accountDomain,
    );
    return result ? true : false;
  }
  async restoreAccountPermission(
    command: DeleteAccountPermissionCommand,
  ): Promise<AccountPermissionResponse> {
    const accountPermission = await this.accountPermissionRepository.find({
      where: { id: command.id },
      withDeleted: true,
    });
    if (!accountPermission[0]) {
      throw new NotFoundException(`Account permission not found`);
    }
    accountPermission[0].deletedAt = null;
    const result = await this.accountPermissionRepository.save(
      accountPermission[0],
    );
    return AccountPermissionResponse.fromEntity(result);
  }
  @OnEvent("update-account-profile")
  async updateAccountProfile(profileInfo): Promise<void> {
    const accountDomain = await this.accountRepository.getById(profileInfo.id);
    if (accountDomain) {
      accountDomain.profileImageFilename = profileInfo.profileImageFilename;
      await this.accountRepository.update(accountDomain.id, accountDomain);
    }
  }
}
