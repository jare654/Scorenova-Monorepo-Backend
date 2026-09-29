import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseRepository } from "@libs/common/repositories/base.repository";
import { SessionEntity } from "./session.entity";

@Injectable()
export class SessionRepository extends BaseRepository<SessionEntity> {
  constructor(
    @InjectRepository(SessionEntity)
    sessionRepository: Repository<SessionEntity>
  ) {
    super(sessionRepository);
  }
}
