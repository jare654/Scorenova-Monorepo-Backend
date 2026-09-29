import {
  ArchivePermissionCommand,
  CreatePermissionCommand,
  UpdatePermissionCommand,
} from "./permission.commands";
import { PermissionResponse } from "./permission.response";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  // OnModuleInit,
} from "@nestjs/common";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { PermissionRepository } from "@account/models/permissions/permission.repository";
import { PermissionEntity } from "@account/models/permissions/permission.entity";


@Injectable()
export class PermissionCommands /*implements OnModuleInit*/ {
  constructor(
    private readonly permissionRepository: PermissionRepository
  ) {}

  async createPermission(
    command: CreatePermissionCommand
  ): Promise<PermissionResponse> {
    const existingPermission = await this.permissionRepository.getOneBy(
      "name",
      command.name
    );
    if (existingPermission) {
      throw new BadRequestException(`Permission already exist`);
    }

    const permissionDomain = CreatePermissionCommand.fromCommand(command);
    permissionDomain.createdBy = command.currentUser.id;
    permissionDomain.updatedBy = command.currentUser.id;

    const permission = await this.permissionRepository.insert(permissionDomain);
    const permissionResponse = PermissionResponse.fromEntity(permission);
    if (permission) {
    }
    return permissionResponse;
  }
  async updatePermission(
    command: UpdatePermissionCommand
  ): Promise<PermissionResponse> {
    const permission = await this.permissionRepository.getById(command.id);
    if (!permission) {
      throw new NotFoundException(`Permission not found`);
    }
    const existingPermission = await this.permissionRepository.getOneBy(
      "name",
      command.name
    );
    if (command.name !== permission.name && existingPermission) {
      throw new BadRequestException(
        `Permission already exist with name ${command.name}`
      );
    }
    permission.name = command.name;
    permission.updatedBy = command.currentUser.id;
    permission.key = command.key;
    const result = await this.permissionRepository.update(
      permission.id,
      permission
    );
    const permissionResponse = PermissionResponse.fromEntity(result);
    if (permission) {
    }
    return permissionResponse;
  }
  async archivePermission(
    command: ArchivePermissionCommand
  ): Promise<PermissionResponse> {
    const permissionDomain = await this.permissionRepository.getById(
      command.id
    );
    if (!permissionDomain) {
      throw new NotFoundException(`Permission not found.`);
    }
    permissionDomain.deletedAt = new Date();
    permissionDomain.deletedBy = command.currentUser.id;
    const result = await this.permissionRepository.update(
      permissionDomain.id,
      permissionDomain
    );
    return PermissionResponse.fromEntity(result);
  }
  async restorePermission(
    id: string,
    currentUser: UserInfo
  ): Promise<PermissionResponse> {
    const permissionDomain = await this.permissionRepository.getById(
      id,
      [],
      true
    );
    if (!permissionDomain) {
      throw new NotFoundException(`Permission not found.`);
    }
    const r = await this.permissionRepository.restore(id);
    if (r) {
      permissionDomain.deletedAt = null;
    }
    return PermissionResponse.fromEntity(permissionDomain);
  }
  async deletePermission(id: string, currentUser: UserInfo): Promise<boolean> {
    const permissionDomain = await this.permissionRepository.getById(
      id,
      [],
      true
    );
    if (!permissionDomain) {
      throw new NotFoundException(`Permission not found.`);
    }
    return await this.permissionRepository.delete(id);
  }
}
