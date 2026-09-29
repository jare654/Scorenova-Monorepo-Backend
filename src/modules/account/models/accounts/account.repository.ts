import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Not, Repository } from "typeorm";
import { BaseRepository } from "@libs/common/repositories/base.repository";
import { AccountEntity } from "./account.entity";
import { CredentialType } from "@libs/common/enums";

@Injectable()
export class AccountRepository extends BaseRepository<AccountEntity> {
  constructor(
    @InjectRepository(AccountEntity)
    accountRepository: Repository<AccountEntity>
  ) {
    super(accountRepository);
  }
  async getAllForNotification(
    type: string,
    withDeleted: boolean
  ): Promise<AccountEntity[]> {
    if (type === "all") {
      const accounts = await this.repository.find({
        where: [{ type: Not(CredentialType.Admin) }],
        relations: [],
        withDeleted: withDeleted,
      });
      if (!accounts.length) {
        return null;
      }
      return accounts;
    } else {
      const accounts = await this.repository.find({
        where: { type: type },
        relations: [],
        withDeleted: withDeleted,
      });
      if (!accounts.length) {
        return null;
      }
      return accounts;
    }
  }
  async getAllCountForNotification(
    type: string,
    withDeleted: boolean
  ): Promise<number> {
    if (type === "all") {
      const count = await this.repository.count({
        where: [{ type: Not(CredentialType.Admin) }],
        relations: [],
        withDeleted: withDeleted,
      });
      return count;
    } else {
      const count = await this.repository.count({
        where: { type: type },
        relations: [],
        withDeleted: withDeleted,
      });
      return count;
    }
  }
  async getThousandForNotification(
    type: string,
    withDeleted: boolean,
    skip: number = 0,
    take: number = 1
  ): Promise<AccountEntity[]> {
    if (type === "all") {
      const accounts = await this.repository.find({
        where: [{ type: Not(CredentialType.Admin) }],
        relations: [],
        withDeleted: withDeleted,
        skip,
        take,
      });
      if (!accounts.length) {
        return null;
      }
      return accounts;
    } else {
      const accounts = await this.repository.find({
        where: { type: type },
        relations: [],
        withDeleted: withDeleted,
        skip,
        take,
      });
      if (!accounts.length) {
        return null;
      }
      return accounts;
    }
  }
  async getUsersByIds(userIds: string[]): Promise<any[]> {
    const accounts = await this.repository.find({
      where: { id: In(userIds) },
    });
    if (!accounts.length) {
      return null;
    }
    return accounts;
  }

  async findByPhoneSuffix(suffix: string): Promise<AccountEntity[]> {
    return this.repository
      .createQueryBuilder("a")
      .where("REPLACE(REPLACE(REPLACE(a.phone_number, '+', ''), ' ', ''), '-', '') LIKE :phone", {
        phone: `%${suffix}`,
      })
      .getMany();
  }
}

