import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseRepository } from "@libs/common/repositories/base.repository";
import { RoleEntity } from "./role.entity";

@Injectable()
export class RoleRepository extends BaseRepository<RoleEntity> {
  constructor(
    @InjectRepository(RoleEntity)
    roleRepository: Repository<RoleEntity>
  ) {
    super(roleRepository);
  }
}
