import { CollectionQuery } from "@libs/collection-query/collection-query";
import { BaseEntity } from "../entities/base.entity";
import { BaseRepository } from "../repositories/base.repository";
import { DataResponseFormat } from "@libs/response-format/data-response-format";
import { QueryConstructor } from "@libs/collection-query/query-constructor";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

export class BaseService<T extends BaseEntity> {
  constructor(
    private repository: Repository<T>,
    private readonly baseRepository: BaseRepository<T>
  ) {}

  // async getAll(relations: string[] = []): Promise<T[]> {
  //   return this.baseRepository.getAll(relations);
  // }
  async getAll(
    query: CollectionQuery,
    response: any
  ): Promise<DataResponseFormat<T>> {
    const dataQuery = QueryConstructor.constructQuery<T>(
      this.repository,
      query
    );
    const d = new DataResponseFormat<T>();
    if (query.count) {
      d.count = await dataQuery.getCount();
    } else {
      const [result, total] = await dataQuery.getManyAndCount();
      // d.data = result.map((entity) => UserResponse.fromEntity(entity));
      d.data = result.map((entity) => response.fromEntity(entity));

      d.count = total;
    }
    return d;
  }
  async getById(id: string, relations: string[] = []): Promise<T> {
    return this.baseRepository.getById(id, relations);
  }

  async create(createDto: Partial<T>): Promise<T> {
    return this.baseRepository.insert(createDto as T);
  }

  async update(id: string, updateDto: Partial<T>): Promise<T> {
    return this.baseRepository.update(id, updateDto);
  }

  async delete(id: string): Promise<boolean> {
    return this.baseRepository.delete(id);
  }
}
