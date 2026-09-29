import { AllowAnonymous } from "@account/auth/decorators/allow-anonymous.decorator";
import { CurrentUser } from "@account/auth/decorators/current-user.decorator";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { PermissionsGuard } from "@account/auth/guards/permission.quard";
import {
  ArchivePermissionCommand,
  CreatePermissionCommand,
  UpdatePermissionCommand,
} from "@account/usecases/permissions/permission.commands";
import { PermissionResponse } from "@account/usecases/permissions/permission.response";
import { PermissionCommands } from "@account/usecases/permissions/permission.usecase.commands";
import { PermissionQueries } from "@account/usecases/permissions/permission.usecase.queries";
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

@Controller("permissions")
@ApiTags("permissions")
@ApiBearerAuth("Bearer")
@ApiResponse({ status: 500, description: "Internal error" })
@ApiResponse({ status: 404, description: "Item not found" })
@ApiExtraModels(DataResponseFormat)
export class PermissionsController {
  constructor(
    private readonly commands: PermissionCommands,
    private readonly permissionQueries: PermissionQueries
  ) {}

  @Get("get-permission/:id")
  @ApiOperation({
    summary: "Get permission details by ID",
    description: "Retrieves a single system permission by its UUID.",
  })
  @ApiOkResponse({ type: PermissionResponse })
  async getPermission(
    @Param("id") id: string,
    @Query() includeQuery: IncludeQuery
  ) {
    return this.permissionQueries.getPermission(id, includeQuery.includes);
  }

  @Get("get-archived-permission/:id")
  @ApiOperation({
    summary: "Get archived permission details by ID",
    description: "Retrieves soft-deleted permission record details by UUID.",
  })
  @ApiOkResponse({ type: PermissionResponse })
  async getArchivedPermission(
    @Param("id") id: string,
    @Query() includeQuery: IncludeQuery
  ) {
    return this.permissionQueries.getPermission(
      id,
      includeQuery.includes,
      true
    );
  }

  @Get("get-permissions")
  @ApiOperation({
    summary: "List all system permissions",
    description: "Retrieves a paginated list of all active system permissions.",
  })
  @ApiPaginatedResponse(PermissionResponse)
  async getPermissions(@Query() query: CollectionQuery) {
    return this.permissionQueries.getPermissions(query);
  }

  @Post("update-permission")
  @UseGuards(PermissionsGuard("manage-permissions"))
  @ApiOperation({
    summary: "Update existing permission (Admin Only)",
    description: "Updates code, description, or group for specified permission.",
  })
  @ApiOkResponse({ type: PermissionResponse })
  async updatePermission(
    @CurrentUser() user: UserInfo,
    @Body() command: UpdatePermissionCommand
  ) {
    command.currentUser = user;
    return this.commands.updatePermission(command);
  }

  @Post("create-permission")
  @UseGuards(PermissionsGuard("manage-permissions"))
  @ApiOperation({
    summary: "Create new permission (Admin Only)",
    description: "Creates a new system permission definition.",
  })
  @ApiOkResponse({ type: PermissionResponse })
  async createPermission(
    @CurrentUser() user: UserInfo,
    @Body() createPermissionCommand: CreatePermissionCommand
  ) {
    createPermissionCommand.currentUser = user;
    return this.commands.createPermission(createPermissionCommand);
  }

  @Delete("archive-permission")
  @UseGuards(PermissionsGuard("manage-permissions"))
  @ApiOperation({
    summary: "Archive permission (Admin Only)",
    description: "Soft-deletes a system permission.",
  })
  @ApiOkResponse({ type: Boolean })
  async archivePermission(
    @CurrentUser() user: UserInfo,
    @Body() archiveCommand: ArchivePermissionCommand
  ) {
    archiveCommand.currentUser = user;
    return this.commands.archivePermission(archiveCommand);
  }

  @Delete("delete-permission/:id")
  @UseGuards(PermissionsGuard("manage-permissions"))
  @ApiOperation({
    summary: "Permanently delete permission (Admin Only)",
    description: "Hard-deletes specified permission from database.",
  })
  @ApiOkResponse({ type: Boolean })
  async deletePermission(
    @CurrentUser() user: UserInfo,
    @Param("id") id: string
  ) {
    return this.commands.deletePermission(id, user);
  }

  @Post("restore-permission/:id")
  @UseGuards(PermissionsGuard("manage-permissions"))
  @ApiOperation({
    summary: "Restore archived permission (Admin Only)",
    description: "Restores soft-deleted permission back to active status.",
  })
  @ApiOkResponse({ type: PermissionResponse })
  async restorePermission(
    @CurrentUser() user: UserInfo,
    @Param("id") id: string
  ) {
    return this.commands.restorePermission(id, user);
  }

  @Get("get-archived-permissions")
  @ApiOperation({
    summary: "List archived permissions",
    description: "Retrieves a paginated list of soft-deleted permissions.",
  })
  @ApiPaginatedResponse(PermissionResponse)
  async getArchivedPermissions(@Query() query: CollectionQuery) {
    return this.permissionQueries.getArchivedPermissions(query);
  }
}
