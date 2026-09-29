import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseRepository } from "@libs/common/repositories/base.repository";
import { ResetPasswordTokenEntity } from "./reset-password.entity";

@Injectable()
export class ResetPasswordTokenRepository extends BaseRepository<ResetPasswordTokenEntity> {
  constructor(
    @InjectRepository(ResetPasswordTokenEntity)
    accountRepository: Repository<ResetPasswordTokenEntity>
  ) {
    super(accountRepository);
  }
}
