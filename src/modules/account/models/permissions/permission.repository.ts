import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseRepository } from "@libs/common/repositories/base.repository";
import { PermissionEntity } from "./permission.entity";

@Injectable()
export class PermissionRepository extends BaseRepository<PermissionEntity> {
  constructor(
    @InjectRepository(PermissionEntity)
    permissionRepository: Repository<PermissionEntity>
  ) {
    super(permissionRepository);
  }
}
