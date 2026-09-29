import { CurrentUser } from "@account/auth/decorators/current-user.decorator";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { PermissionsGuard } from "@account/auth/guards/permission.quard";
import { PermissionResponse } from "@account/usecases/permissions/permission.response";
import {
  ArchiveRolePermissionCommand,
  CreateRolePermissionsCommand,
  DeleteRolePermissionCommand,
} from "@account/usecases/roles/role-permission.commands";
import { RolePermissionResponse } from "@account/usecases/roles/role-permission.response";
import {
  ArchiveRoleCommand,
  CreateRoleCommand,
  UpdateRoleCommand,
} from "@account/usecases/roles/role.commands";
import { RoleResponse } from "@account/usecases/roles/role.response";
import { RoleCommands } from "@account/usecases/roles/role.usecase.commands";
import { RoleQueries } from "@account/usecases/roles/role.usecase.queries";
import { CollectionQuery } from "@libs/collection-query/collection-query";
import { IncludeQuery } from "@libs/collection-query/include-query";
import { ApiPaginatedResponse } from "@libs/response-format/api-paginated-response";
import { DataResponseFormat } from "@libs/response-format/data-response-format";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

@Controller("roles")
@ApiTags("roles")
@ApiBearerAuth("Bearer")
@ApiResponse({ status: 500, description: "Internal error" })
@ApiResponse({ status: 404, description: "Item not found" })
@ApiExtraModels(DataResponseFormat)
export class RolesController {
  constructor(
    private readonly commands: RoleCommands,
    private readonly roleQueries: RoleQueries
  ) {}
  @Get("get-role/:id")
  @ApiOperation({
    summary: "Get role by ID",
    description: "Retrieves details of a specific system role by UUID.",
  })
  @ApiOkResponse({ type: RoleResponse })
  async getRole(@Param("id") id: string, @Query() includeQuery: IncludeQuery) {
    return this.roleQueries.getRole(id, includeQuery.includes);
  }
  @Get("get-archived-role/:id")
  @ApiOperation({
    summary: "Get archived role by ID",
    description: "Retrieves details of soft-deleted role by UUID.",
  })
  @ApiOkResponse({ type: RoleResponse })
  async getArchivedRole(
    @Param("id") id: string,
    @Query() includeQuery: IncludeQuery
  ) {
    return this.roleQueries.getRole(id, includeQuery.includes, true);
  }
  @Get("get-roles")
  @ApiOperation({
    summary: "List all roles",
    description: "Retrieves a paginated list of active system roles.",
  })
  @ApiPaginatedResponse(RoleResponse)
  async getRoles(@Query() query: CollectionQuery) {
    return this.roleQueries.getRoles(query);
  }
  @Post("update-role")
  @UseGuards(PermissionsGuard("manage-roles"))
  @ApiOperation({
    summary: "Update existing role (Admin Only)",
    description: "Updates name or description of specified role.",
  })
  @ApiOkResponse({ type: RoleResponse })
  async updateRole(
    @CurrentUser() user: UserInfo,
    @Body() command: UpdateRoleCommand
  ) {
    command.currentUser = user;
    return this.commands.updateRole(command);
  }
  @Post("create-role")
  @UseGuards(PermissionsGuard("manage-roles"))
  @ApiOperation({
    summary: "Create new role (Admin Only)",
    description: "Creates a new system role definition.",
  })
  @ApiOkResponse({ type: RoleResponse })
  async createRole(
    @CurrentUser() user: UserInfo,
    @Body() createRoleCommand: CreateRoleCommand
  ) {
    createRoleCommand.currentUser = user;
    return this.commands.createRole(createRoleCommand);
  }
  @Delete("archive-role")
  @UseGuards(PermissionsGuard("manage-roles"))
  @ApiOperation({
    summary: "Archive role (Admin Only)",
    description: "Soft-deletes a system role.",
  })
  @ApiOkResponse({ type: Boolean })
  async archiveRole(
    @CurrentUser() user: UserInfo,
    @Body() archiveCommand: ArchiveRoleCommand
  ) {
    archiveCommand.currentUser = user;
    return this.commands.archiveRole(archiveCommand);
  }
  @Delete("delete-role/:id")
  @UseGuards(PermissionsGuard("manage-roles"))
  @ApiOperation({
    summary: "Permanently delete role (Admin Only)",
    description: "Hard-deletes specified role from database.",
  })
  @ApiOkResponse({ type: Boolean })
  async deleteRole(@CurrentUser() user: UserInfo, @Param("id") id: string) {
    return this.commands.deleteRole(id, user);
  }
  @Post("restore-role/:id")
  @UseGuards(PermissionsGuard("manage-roles"))
  @ApiOperation({
    summary: "Restore archived role (Admin Only)",
    description: "Restores soft-deleted role back to active status.",
  })
  @ApiOkResponse({ type: RoleResponse })
  async restoreRole(@CurrentUser() user: UserInfo, @Param("id") id: string) {
    return this.commands.restoreRole(id, user);
  }
  @Get("get-archived-roles")
  @ApiOperation({
    summary: "List archived roles",
    description: "Retrieves a paginated list of soft-deleted roles.",
  })
  @ApiPaginatedResponse(RoleResponse)
  async getArchivedRoles(@Query() query: CollectionQuery) {
    return this.roleQueries.getArchivedRoles(query);
  }

  @Post("add-role-permission")
  @ApiOperation({
    summary: "Attach permission to role",
    description: "Links specified permission ID to target role ID.",
  })
  @ApiOkResponse({ type: PermissionResponse, isArray: true })
  async addDriverRolePermission(
    @CurrentUser() user: UserInfo,
    @Body() command: CreateRolePermissionsCommand
  ) {
    command.currentUser = user;
    return this.commands.addRolePermission(command);
  }
  @Delete("remove-role-permission")
  @ApiOperation({
    summary: "Remove permission from role",
    description: "Detaches permission from target role.",
  })
  @ApiOkResponse({ type: Boolean })
  async removeDriverRolePermission(
    @CurrentUser() user: UserInfo,
    @Body() removeRolePermissionCommand: DeleteRolePermissionCommand
  ) {
    removeRolePermissionCommand.currentUser = user;
    return this.commands.deleteRolePermission(removeRolePermissionCommand);
  }
  @Delete("archive-role-permission")
  @ApiOperation({
    summary: "Archive role permission mapping",
    description: "Soft-deletes permission mapping for a role.",
  })
  @ApiOkResponse({ type: Boolean })
  async archiveDriverRolePermission(
    @CurrentUser() user: UserInfo,
    @Body() archiveRolePermissionCommand: ArchiveRolePermissionCommand
  ) {
    archiveRolePermissionCommand.currentUser = user;
    return this.commands.archiveRolePermission(archiveRolePermissionCommand);
  }
  @Get("get-role-permission/:id")
  @ApiOperation({
    summary: "Get specific role-permission mapping details",
    description: "Retrieves single role permission assignment detail by ID.",
  })
  @ApiOkResponse({ type: RolePermissionResponse })
  async getRolePermission(
    @Param("id") id: string,
    @Query() includeQuery: IncludeQuery
  ) {
    return this.roleQueries.getRolePermission(id, includeQuery.includes);
  }
  @Get("get-role-permissions")
  @ApiOperation({
    summary: "List all role-permission mappings",
    description: "Retrieves a paginated list of all role permission assignments.",
  })
  @ApiPaginatedResponse(RolePermissionResponse)
  async getRolePermissions(@Query() query: CollectionQuery) {
    return this.roleQueries.getRolePermissions(query);
  }
  @Get("get-archived-role-permissions")
  @ApiOperation({
    summary: "List archived role-permission mappings",
    description: "Retrieves soft-deleted role permission assignments.",
  })
  @ApiPaginatedResponse(RolePermissionResponse)
  async getArchivedRolePermissions(@Query() query: CollectionQuery) {
    return this.roleQueries.getArchivedRolePermissions(query);
  }
  @Post("restore-role-permission")
  @ApiOperation({
    summary: "Restore archived role-permission mapping",
    description: "Restores soft-deleted role permission assignment.",
  })
  @ApiOkResponse({ type: RolePermissionResponse })
  async restoreDriverRolePermission(
    @CurrentUser() user: UserInfo,
    @Body() command: DeleteRolePermissionCommand
  ) {
    command.currentUser = user;
    return this.commands.restoreRolePermission(command);
  }
  @Get("get-role-permissions/:roleId")
  @ApiOperation({
    summary: "Get permissions for a specific role",
    description: "Retrieves all permissions associated with roleId.",
  })
  @ApiPaginatedResponse(PermissionResponse)
  async getUserPermissions(
    @Param("roleId") roleId: string,
    @Query() query: CollectionQuery
  ) {
    return this.roleQueries.getPermissionsByRoleId(roleId, query);
  }
}
