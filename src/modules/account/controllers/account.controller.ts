import { CurrentUser } from "@account/auth/decorators/current-user.decorator";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { RolesGuard } from "@account/auth/guards/role.quards";
import {
  AddAccountPermissionsCommand,
  ArchiveAccountPermissionCommand,
  DeleteAccountPermissionCommand,
} from "@account/usecases/accounts/account-permission.commands";
import { AccountPermissionResponse } from "@account/usecases/accounts/account-permission.response";
import {
  ArchiveAccountRoleCommand,
  CreateAccountRolesCommand,
  DeleteAccountRoleCommand,
} from "@account/usecases/accounts/account-role.commands";

import { AccountRoleResponse } from "@account/usecases/accounts/account-role.response";
import { AccountResponse } from "@account/usecases/accounts/account.response";
import { CreateAdminCommand, UpdateAccountCommand } from "@account/usecases/accounts/account.commands";
import { AccountCommands } from "@account/usecases/accounts/account.usecase.commands";
import { AccountQuery } from "@account/usecases/accounts/account.usecase.queries";
import { PermissionResponse } from "@account/usecases/permissions/permission.response";
import { RoleResponse } from "@account/usecases/roles/role.response";
import { CollectionQuery } from "@libs/collection-query/collection-query";
import { IncludeQuery } from "@libs/collection-query/include-query";
import { FilterOperators } from "@libs/collection-query/filter_operators";
import { ApiPaginatedResponse } from "@libs/response-format/api-paginated-response";
import { DataResponseFormat } from "@libs/response-format/data-response-format";
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AccountEntity } from "@account/models/accounts/account.entity";
import { ApiBearerAuth, ApiExtraModels, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { Public } from "@account/auth/decorators/public.decorator";
import { NotificationService } from "../../notification/notification.service";

export class GrantPremiumWithDatesDto {
  @ApiProperty({ example: "2026-01-01" })
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ example: "2026-12-31" })
  @IsString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ example: "annual" })
  @IsString()
  @IsNotEmpty()
  plan: string;
}

export class ExtendPremiumDto {
  @ApiProperty({ example: "2027-12-31" })
  @IsString()
  @IsNotEmpty()
  endDate: string;
}

export class NotifyUserDto {
  @ApiProperty({ example: "Important Update" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: "Your subscription has been renewed." })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({ example: "notification", enum: ["notification", "sms", "both"] })
  @IsOptional()
  @IsString()
  channel?: string;
}

export class DirectGrantPremiumDto {
  @ApiProperty({ example: "+251798687678" })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  years?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  durationDays?: number;

  @ApiPropertyOptional({ example: "Monthly" })
  @IsOptional()
  plan?: string;
}

@Controller("accounts")
@ApiTags("accounts")
@ApiBearerAuth("Bearer")
@ApiResponse({ status: 500, description: "Internal server error" })
@ApiResponse({ status: 404, description: "Account or item not found" })
@ApiResponse({ status: 401, description: "Unauthorized - Bearer token missing or invalid" })
@ApiExtraModels(DataResponseFormat)
export class AccountsController {
  constructor(
    private command: AccountCommands,
    private accountQuery: AccountQuery,
    private notificationService: NotificationService,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
  ) { }

  @Get("me")
  @ApiOperation({
    summary: "Get current account profile",
    description: "Retrieves full profile and account details for the currently authenticated user based on JWT token.",
  })
  @ApiOkResponse({ type: AccountResponse })
  async getMe(@CurrentUser() user: UserInfo) {
    return this.accountQuery.getAccount(user.id);
  }

  @Get("study-goals")
  @ApiOperation({
    summary: "Get study goals for current user",
    description: "Retrieves configured daily questions, weekly questions, and accuracy goals.",
  })
  async getStudyGoals(@CurrentUser() user: UserInfo) {
    const account = await this.accountRepo.findOne({ where: { id: user.id } });
    const daily = account?.studyGoals?.dailyTarget ?? 20;
    const weekly = account?.studyGoals?.weeklyTarget ?? 5;
    const accuracy = account?.studyGoals?.accuracyTarget ?? 80;
    return {
      dailyTargetQuestions: daily,
      dailyQuestions: daily,
      weeklyTargetHours: weekly,
      weeklyQuestions: weekly,
      accuracyTargetPercentage: accuracy,
      accuracyTarget: accuracy,
    };
  }

  @Put("study-goals")
  @ApiOperation({
    summary: "Update study goals for current user",
    description: "Updates daily, weekly, or accuracy study targets.",
  })
  async updateStudyGoals(
    @CurrentUser() user: UserInfo,
    @Body() body: any
  ) {
    const account = await this.accountRepo.findOne({ where: { id: user.id } });
    if (!account) throw new NotFoundException("Account not found");

    account.studyGoals = {
      dailyTarget: body.dailyTargetQuestions ?? body.dailyQuestions ?? account.studyGoals?.dailyTarget ?? 20,
      weeklyTarget: body.weeklyTargetHours ?? body.weeklyQuestions ?? account.studyGoals?.weeklyTarget ?? 5,
      accuracyTarget: body.accuracyTargetPercentage ?? body.accuracyTarget ?? account.studyGoals?.accuracyTarget ?? 80,
    };
    await this.accountRepo.save(account);

    return {
      success: true,
      studyGoals: {
        dailyTargetQuestions: account.studyGoals.dailyTarget,
        weeklyTargetHours: account.studyGoals.weeklyTarget,
        accuracyTargetPercentage: account.studyGoals.accuracyTarget,
      },
    };
  }

  @Get("get-account/:id")
  @ApiOperation({
    summary: "Get account by ID",
    description: "Retrieves single account by unique UUID. Supports optional relation inclusions.",
  })
  @ApiOkResponse({ type: AccountResponse })
  async getAccount(
    @Param("id") id: string,
    @Query() includeQuery: IncludeQuery
  ) {
    return this.accountQuery.getAccount(id, includeQuery.includes);
  }

  @Get("get-accounts")
  @ApiOperation({
    summary: "Get list of user accounts (students, admins)",
    description: "Retrieves a paginated list of accounts. Supports filtering by gradeId, type ('student' | 'admin'), search, pagination, and sorting.",
  })
  @ApiQuery({ name: "gradeId", required: false, type: String, description: "Filter accounts by grade UUID" })
  @ApiQuery({ name: "type", required: false, type: String, description: "Filter accounts by account type ('student' | 'admin')" })
  @ApiPaginatedResponse(AccountResponse)
  async getAccounts(
    @Query() query: CollectionQuery,
    @Query("gradeId") gradeId?: string,
    @Query("type") type?: string,
  ) {
    const activeGradeId = gradeId || query.gradeId;
    const activeType = type || query.type;

    if (activeGradeId) {
      if (!query.filter) query.filter = [];
      query.filter.push([
        {
          field: "gradeId",
          operator: FilterOperators.EqualTo,
          value: activeGradeId,
        },
      ]);
    }
    if (activeType) {
      if (!query.filter) query.filter = [];
      query.filter.push([
        {
          field: "type",
          operator: FilterOperators.EqualTo,
          value: activeType,
        },
      ]);
    }
    return this.accountQuery.getAccounts(query);
  }

  @Post("create-admin")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Create a new admin account (Admin Only)",
    description: "Creates an admin account with specified phone number, name, and permissions.",
  })
  @ApiOkResponse({ type: AccountResponse })
  async createAdmin(@Body() body: CreateAdminCommand) {
    return this.command.createAdmin(body);
  }

  @Get("get-archived-accounts")
  @ApiOperation({
    summary: "Get archived/deleted user accounts",
    description: "Retrieves soft-deleted or archived user accounts with pagination.",
  })
  @ApiPaginatedResponse(AccountResponse)
  async getArchivedAccounts(@Query() query: CollectionQuery) {
    return this.accountQuery.getArchivedAccounts(query);
  }

  @Post("add-account-role")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Assign role to account (Admin Only)",
    description: "Assigns specified role ID to a target user account.",
  })
  @ApiOkResponse({ type: RoleResponse, isArray: true })
  async addDriverAccountRole(
    @CurrentUser() user: UserInfo,
    @Body() command: CreateAccountRolesCommand
  ) {
    command.currentUser = user;
    return this.command.addAccountRole(command);
  }

  @Delete("remove-account-role")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Remove role from account (Admin Only)",
    description: "Removes assigned role from target user account.",
  })
  @ApiOkResponse({ type: Boolean })
  async removeDriverAccountRole(
    @CurrentUser() user: UserInfo,
    @Body() removeAccountRoleCommand: DeleteAccountRoleCommand
  ) {
    removeAccountRoleCommand.currentUser = user;
    return this.command.deleteAccountRole(removeAccountRoleCommand);
  }

  @Delete("archive-account-role")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Archive role from account (Admin only)",
    description: "Soft-deletes/archives assigned role for a user account.",
  })
  @ApiOkResponse({ type: Boolean })
  async archiveDriverAccountRole(
    @CurrentUser() user: UserInfo,
    @Body() archiveAccountRoleCommand: ArchiveAccountRoleCommand
  ) {
    archiveAccountRoleCommand.currentUser = user;
    return this.command.archiveAccountRole(archiveAccountRoleCommand);
  }

  @Get("get-account-role/:id")
  @ApiOperation({
    summary: "Get specific account-role mapping by ID",
    description: "Fetches details of single account role assignment.",
  })
  @ApiOkResponse({ type: AccountRoleResponse })
  async getAccountRole(
    @Param("id") id: string,
    @Query() includeQuery: IncludeQuery
  ) {
    return this.accountQuery.getAccountRole(id, includeQuery.includes);
  }

  @Get("get-account-roles")
  @ApiOperation({
    summary: "List all account-role mappings",
    description: "Retrieves paginated list of all account role assignments.",
  })
  @ApiPaginatedResponse(AccountRoleResponse)
  async getAccountRoles(@Query() query: CollectionQuery) {
    return this.accountQuery.getAccountRoles(query);
  }

  @Get("get-user-roles/:accountId")
  @ApiOperation({
    summary: "Get roles assigned to a user account",
    description: "Retrieves all roles assigned to specific accountId.",
  })
  @ApiPaginatedResponse(RoleResponse)
  async getUserRoles(
    @Param("accountId") accountId: string,
    @Query() query: CollectionQuery
  ) {
    return this.accountQuery.getRolesByAccountId(accountId, query);
  }

  @Get("get-user-permissions/:accountId")
  @ApiOperation({
    summary: "Get permissions assigned to a user account",
    description: "Retrieves list of effective permissions granted to accountId.",
  })
  @ApiPaginatedResponse(PermissionResponse)
  async getUserPermissions(
    @Param("accountId") accountId: string,
    @Query() query: CollectionQuery
  ) {
    return this.accountQuery.getPermissionsByAccountId(accountId, query);
  }

  @Get("get-user-permissions-by-role-id/:accountId/:roleId")
  @ApiOperation({
    summary: "Get permissions for user account under specific role",
    description: "Returns permissions assigned to accountId for roleId.",
  })
  @ApiPaginatedResponse(PermissionResponse)
  async getUserPermissionsByRoleId(
    @Param("accountId") accountId: string,
    @Param("roleId") roleId: string,
    @Query() query: CollectionQuery
  ) {
    return this.accountQuery.getPermissionsByAccountIdAndRoleId(
      accountId,
      roleId,
      query
    );
  }

  @Get("get-archived-account-roles")
  @ApiOperation({
    summary: "List archived account-role mappings",
    description: "Retrieves soft-deleted account-role assignments.",
  })
  @ApiPaginatedResponse(AccountRoleResponse)
  async getArchivedAccountRoles(@Query() query: CollectionQuery) {
    return this.accountQuery.getArchivedAccountRoles(query);
  }

  @Post("restore-account-role")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Restore archived account role assignment (Admin Only)",
    description: "Restores soft-deleted account role assignment.",
  })
  @ApiOkResponse({ type: AccountRoleResponse })
  async restoreDriverAccountRole(
    @CurrentUser() user: UserInfo,
    @Body() command: DeleteAccountRoleCommand
  ) {
    command.currentUser = user;
    return this.command.restoreAccountRole(command);
  }

  //Account permission
  @Post("add-account-permission")
  @UseGuards(RolesGuard("admin|owner"))
  @ApiOperation({
    summary: "Grant direct permission to account (Admin Only)",
    description: "Directly attaches permissions to user account.",
  })
  @ApiOkResponse({ type: PermissionResponse, isArray: true })
  async addDriverAccountPermission(
    @CurrentUser() user: UserInfo,
    @Body() createAccountPermissionCommand: AddAccountPermissionsCommand
  ) {
    createAccountPermissionCommand.currentUser = user;
    return this.command.addAccountPermission(createAccountPermissionCommand);
  }

  @Delete("remove-account-permission")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Remove permission from account (Admin Only)",
    description: "Removes direct permission from user account.",
  })
  @ApiOkResponse({ type: Boolean })
  async removeDriverAccountPermission(
    @CurrentUser() user: UserInfo,
    @Body() removeAccountPermissionCommand: DeleteAccountPermissionCommand
  ) {
    removeAccountPermissionCommand.currentUser = user;
    return this.command.deleteAccountPermission(removeAccountPermissionCommand);
  }

  @Delete("archive-account-permission")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Archive account permission (Admin Only)",
    description: "Soft-deletes direct permission assignment.",
  })
  @ApiOkResponse({ type: Boolean })
  async archiveDriverAccountPermission(
    @CurrentUser() user: UserInfo,
    @Body() archiveAccountPermissionCommand: ArchiveAccountPermissionCommand
  ) {
    archiveAccountPermissionCommand.currentUser = user;
    return this.command.archiveAccountPermission(
      archiveAccountPermissionCommand
    );
  }

  @Get("get-account-permission/:id")
  @ApiOperation({
    summary: "Get specific account permission by ID",
    description: "Fetches details of account permission assignment.",
  })
  @ApiOkResponse({ type: AccountPermissionResponse })
  async getAccountPermission(
    @Param("id") id: string,
    @Query() includeQuery: IncludeQuery
  ) {
    return this.accountQuery.getAccountPermission(id, includeQuery.includes);
  }

  @Get("get-account-permissions")
  @ApiOperation({
    summary: "List all account permission assignments",
    description: "Retrieves paginated list of all account permission assignments.",
  })
  @ApiPaginatedResponse(AccountPermissionResponse)
  async getAccountPermissions(@Query() query: CollectionQuery) {
    return this.accountQuery.getAccountPermissions(query);
  }

  @Get("get-archived-account-permissions")
  @ApiOperation({
    summary: "List archived account permission assignments",
    description: "Retrieves soft-deleted account permission assignments.",
  })
  @ApiPaginatedResponse(AccountPermissionResponse)
  async getArchivedAccountPermissions(@Query() query: CollectionQuery) {
    return this.accountQuery.getArchivedAccountPermissions(query);
  }

  @Post("restore-account-permission")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Restore archived account permission (Admin Only)",
    description: "Restores soft-deleted account permission assignment.",
  })
  @ApiOkResponse({ type: AccountPermissionResponse })
  async restoreDriverAccountPermission(
    @CurrentUser() user: UserInfo,
    @Body() command: DeleteAccountPermissionCommand
  ) {
    command.currentUser = user;
    return this.command.restoreAccountPermission(command);
  }

  // --- Premium Users ---

  @Get("premium-users")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({
    summary: "List premium users (Admin Only)",
    description: "Retrieves list of accounts with active premium subscriptions.",
  })
  async getPremiumUsers() {
    return this.command.getPremiumUsers();
  }

  // --- Admin User Actions ---

  @Post(":id/suspend")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Suspend or block user account (Admin Only)",
    description: "Toggles active/blocked state for target account.",
  })
  @ApiOkResponse({ type: Boolean })
  async suspendUser(@Param("id") id: string) {
    return this.command.activateOrBlockAccount({ id, phoneNumber: "" });
  }

  @Post(":id/premium")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Toggle user premium status (Admin Only)",
    description: "Toggles premium status on/off for specified user account.",
  })
  @ApiOkResponse({ type: Boolean })
  async grantPremium(@Param("id") id: string) {
    return this.command.togglePremium(id);
  }

  @Post(":id/grant-premium")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({
    summary: "Grant premium access with start/end dates (Admin Only)",
    description: "Grants premium plan to target account with explicit start and end dates.",
  })
  async grantPremiumWithDates(
    @Param("id") id: string,
    @Body() body: GrantPremiumWithDatesDto,
  ) {
    return this.command.grantPremiumWithDates(id, body.startDate, body.endDate, body.plan);
  }

  @Public()
  @Post("direct-grant-premium")
  @SkipThrottle()
  @ApiOperation({
    summary: "Directly grant premium access by phone number",
    description: "Grants premium access to any account matching the phone number.",
  })
  async directGrantPremium(@Body() body: DirectGrantPremiumDto) {
    return this.command.grantPremiumByPhoneNumber(
      body.phoneNumber,
      body.years,
      body.durationDays,
      body.plan,
    );
  }

  @Post(":id/revoke-premium")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({
    summary: "Revoke premium access (Admin Only)",
    description: "Cancels premium subscription status for specified account.",
  })
  async revokePremium(@Param("id") id: string) {
    return this.command.revokePremium(id);
  }

  @Post(":id/extend-premium")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({
    summary: "Extend premium subscription end date (Admin Only)",
    description: "Updates the premium end date for specified account.",
  })
  async extendPremium(
    @Param("id") id: string,
    @Body() body: ExtendPremiumDto,
  ) {
    return this.command.extendPremium(id, body.endDate);
  }

  @Post(":id/reset-password")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Reset user password by admin (Admin Only)",
    description: "Resets password for target account and returns new temporary credentials.",
  })
  @ApiOkResponse({ type: Object })
  async resetPassword(@Param("id") id: string) {
    return this.command.resetUserPassword(id);
  }

  @Post(":id/notify")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Send push notification to user (Admin Only)",
    description: "Sends push notification title and body to user's FCM device token.",
  })
  @ApiOkResponse({ type: Boolean })
  async notifyUser(
    @Param("id") id: string,
    @Body() body: NotifyUserDto
  ) {
    const user = await this.accountQuery.getAccount(id);
    return this.notificationService.sendToUser(
      id,
      body.title,
      body.body,
      user.fcmId
    );
  }

  @Post("update-profile")
  @ApiOperation({
    summary: "Update own profile information",
    description: "Allows authenticated user to update their name, gender, gradeId, or streamId.",
  })
  @ApiOkResponse({ type: AccountResponse })
  async updateProfile(
    @CurrentUser() user: UserInfo,
    @Body() command: UpdateAccountCommand
  ) {
    command.accountId = user.id;
    return this.command.updateAccount(command);
  }

  @Post(":id/update")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Update user account by admin (Admin Only)",
    description: "Allows admin to update any user's profile details.",
  })
  @ApiOkResponse({ type: AccountResponse })
  async updateAccountByAdmin(
    @Param("id") id: string,
    @Body() command: UpdateAccountCommand
  ) {
    command.accountId = id;
    return this.command.updateAccount(command);
  }

  @Delete("me")
  @ApiOperation({
    summary: "Delete own user account",
    description: "Soft-deletes the caller's own account.",
  })
  @ApiOkResponse({ type: Boolean })
  async deleteOwnAccount(@CurrentUser() user: UserInfo) {
    return this.command.deleteAccount(user.id);
  }

  @Delete(":id")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Delete user account by admin (Admin Only)",
    description: "Soft-deletes specified user account.",
  })
  @ApiOkResponse({ type: Boolean })
  async deleteAccountByAdmin(@Param("id") id: string) {
    return this.command.deleteAccount(id);
  }
}
