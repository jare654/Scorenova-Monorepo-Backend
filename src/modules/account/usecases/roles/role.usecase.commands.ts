import {
  ArchiveRoleCommand,
  CreateRoleCommand,
  UpdateRoleCommand,
} from "./role.commands";
import { RoleResponse } from "./role.response";
import {
  BadRequestException,
  Injectable,
  NotFoundException,

} from "@nestjs/common";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import {
  ArchiveRolePermissionCommand,
  CreateRolePermissionCommand,
  CreateRolePermissionsCommand,
  DeleteRolePermissionCommand,
  UpdateRolePermissionCommand,
} from "./role-permission.commands";
import { RolePermissionResponse } from "./role-permission.response";
import { InjectRepository } from "@nestjs/typeorm";
import { RolePermissionEntity } from "@account/models/roles/role-permission.entity";
import { Repository } from "typeorm";
import { CollectionQuery } from "@libs/collection-query/collection-query";
import { FilterOperators } from "@libs/collection-query/filter_operators";
import { RoleRepository } from "@account/models/roles/role.repository";
import { RoleEntity } from "@account/models/roles/role.entity";
import { PermissionResponse } from "../permissions/permission.response";
import { PermissionQueries } from "../permissions/permission.usecase.queries";
import { AccountCommands } from "../accounts/account.usecase.commands";

import { Tables } from "@libs/common/enums";
import { AddAccountPermissionsCommand } from "../accounts/account-permission.commands";
import { AccountQuery } from "../accounts/account.usecase.queries";

@Injectable()
export class RoleCommands {
  constructor(
    private readonly roleRepository: RoleRepository,
    @InjectRepository(RolePermissionEntity)
    private rolePermissionRepository: Repository<RolePermissionEntity>,
    private permissionQueries: PermissionQueries,
    private accountCommands: AccountCommands,
    private accountQuery: AccountQuery
  ) {}

  async createRole(command: CreateRoleCommand): Promise<RoleResponse> {
    const existingRole = await this.roleRepository.getOneBy(
      "name",
      command.name
    );
    if (existingRole) {
      throw new BadRequestException(`Role already exist`);
    }

    const roleDomain = CreateRoleCommand.fromCommand(command);
    roleDomain.createdBy = command.currentUser.id;
    roleDomain.updatedBy = command.currentUser.id;

    const role = await this.roleRepository.insert(roleDomain);
    const roleResponse = RoleResponse.fromEntity(role);
    if (role) {
    }
    return roleResponse;
  }
  async updateRole(command: UpdateRoleCommand): Promise<RoleResponse> {
    const role = await this.roleRepository.getById(command.id);
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }
    const existingRole = await this.roleRepository.getOneBy(
      "name",
      command.name
    );
    if (command.name !== role.name && existingRole) {
      throw new BadRequestException(
        `Role already exist with name ${command.name}`
      );
    }
    role.name = command.name;
    role.key = command.key;
    role.updatedBy = command.currentUser.id;
    const result = await this.roleRepository.update(role.id, role);
    const roleResponse = RoleResponse.fromEntity(result);
    if (role) {
    }
    return roleResponse;
  }
  async archiveRole(command: ArchiveRoleCommand): Promise<RoleResponse> {
    const roleDomain = await this.roleRepository.getById(command.id);
    if (!roleDomain) {
      throw new NotFoundException(`Role not found.`);
    }
    roleDomain.deletedAt = new Date();
    roleDomain.deletedBy = command.currentUser.id;
    const result = await this.roleRepository.update(roleDomain.id, roleDomain);
    return RoleResponse.fromEntity(result);
  }
  async restoreRole(id: string, currentUser: UserInfo): Promise<RoleResponse> {
    const roleDomain = await this.roleRepository.getById(id, [], true);
    if (!roleDomain) {
      throw new NotFoundException(`Role not found.`);
    }
    const r = await this.roleRepository.restore(id);
    if (r) {
      roleDomain.deletedAt = null;
    }
    return RoleResponse.fromEntity(roleDomain);
  }
  async deleteRole(id: string, currentUser: UserInfo): Promise<boolean> {
    const roleDomain = await this.roleRepository.getById(id, [], true);
    if (!roleDomain) {
      throw new NotFoundException(`Role not found.`);
    }
    return await this.roleRepository.delete(id);
  }
  async addRolePermission(
    command: CreateRolePermissionsCommand
  ): Promise<PermissionResponse[]> {
    const roleDomain = await this.roleRepository.getById(command.roleId, [
      Tables.RolePermissions,
    ]);
    if (!roleDomain) {
      throw new NotFoundException(`Role not found.`);
    }
    // roleDomain.rolePermissions = [];
    for (const permissionId of command.permissions) {
      const isExist = roleDomain.rolePermissions.find(
        (accountPermission) => accountPermission.permissionId === permissionId
      );
      if (!isExist) {
        const rolePermission = CreateRolePermissionCommand.fromCommand({
          roleId: command.roleId,
          permissionId: permissionId,
        });
        roleDomain.addRolePermission(rolePermission);
      }
    }

    let newPermissions: RolePermissionEntity[];
    newPermissions = roleDomain.rolePermissions.filter((accountPermission) => {
      return command.permissions.includes(accountPermission.permissionId);
    });
    const roleQuery = new CollectionQuery();
    roleQuery.filter = [];
    roleQuery.filter.push([
      {
        field: "roleId",
        operator: FilterOperators.EqualTo,
        value: command.roleId,
      },
    ]);
    const accounts = await this.accountQuery.getAccountRoles(roleQuery);
    for (const account of accounts.data) {
      const accountPermissionsCommand = new AddAccountPermissionsCommand();
      accountPermissionsCommand.roleId = command.roleId;
      accountPermissionsCommand.accountId = account.accountId;
      accountPermissionsCommand.permissions = newPermissions.map(
        (permission) => {
          return permission.permissionId;
        }
      );
      await this.accountCommands.addAccountPermission(
        accountPermissionsCommand
      );
    }
    roleDomain.rolePermissions = newPermissions;
    const result = await this.roleRepository.save(roleDomain);
    if (!result) return null;

    if (result.rolePermissions.length === 0) return [];
    const rolePermissions = result.rolePermissions.map(
      (accountPermission) => accountPermission.permissionId
    );
    const query = new CollectionQuery();
    query.filter = [
      [
        {
          field: "id",
          operator: FilterOperators.In,
          value: rolePermissions.join(","),
        },
      ],
    ];
    const responseData = await this.permissionQueries.getPermissions(query);
    return responseData.data;
  }
  async updateRolePermission(
    command: UpdateRolePermissionCommand
  ): Promise<RolePermissionResponse> {
    const roleDomain = await this.roleRepository.getById(command.roleId);
    if (!roleDomain) {
      throw new NotFoundException(`Role not found with.`);
    }
    const oldPayload = roleDomain.rolePermissions.find(
      (b) => b.id === command.id
    );
    if (oldPayload) {
      throw new BadRequestException(`Permission already assigned to this role`);
    }

    const rolePermission = UpdateRolePermissionCommand.fromCommand(command);
    roleDomain.updateRolePermission(rolePermission);
    const result = await this.roleRepository.update(roleDomain.id, roleDomain);
    if (!result) return null;

    const response = RolePermissionResponse.fromEntity(
      result.rolePermissions.find(
        (rolePermission) => rolePermission.id === command.id
      )
    );
    return response;
  }
  async deleteRolePermission(
    command: DeleteRolePermissionCommand
  ): Promise<boolean> {
    const rolePermission = await this.rolePermissionRepository.find({
      where: { roleId: command.roleId, permissionId: command.permissionId },
      withDeleted: true,
    });
    if (!rolePermission[0]) {
      throw new NotFoundException(`Role permission not found.`);
    }
    const result = await this.rolePermissionRepository.delete({
      id: rolePermission[0].id,
    });
    return result ? true : false;
  }
  async archiveRolePermission(
    command: ArchiveRolePermissionCommand
  ): Promise<boolean> {
    const roleDomain = await this.roleRepository.getById(command.roleId);
    if (!roleDomain) {
      throw new NotFoundException(` Role not found with.`);
    }
    const rolePermission = roleDomain.rolePermissions.find(
      (rolePermission) => rolePermission.id === command.id
    );
    rolePermission.deletedAt = new Date();
    rolePermission.deletedBy = command.currentUser.id;
    rolePermission.archiveReason = command.reason;
    roleDomain.updateRolePermission(rolePermission);
    const result = await this.roleRepository.update(roleDomain.id, roleDomain);
    return result ? true : false;
  }
  async restoreRolePermission(
    command: DeleteRolePermissionCommand
  ): Promise<RolePermissionResponse> {
    const rolePermission = await this.rolePermissionRepository.find({
      where: { id: command.permissionId },
      withDeleted: true,
    });
    if (!rolePermission[0]) {
      throw new NotFoundException(`Role Permission not found.`);
    }
    rolePermission[0].deletedAt = null;
    const result = await this.rolePermissionRepository.save(rolePermission[0]);
    return RolePermissionResponse.fromEntity(result);
  }
}
