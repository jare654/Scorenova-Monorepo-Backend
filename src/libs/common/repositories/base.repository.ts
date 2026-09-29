import {
  DeepPartial,
  EntityManager,
  FindOneOptions,
  FindOptionsWhere,
  ObjectType,
  Repository,
} from "typeorm";
import { BaseEntity } from "../entities/base.entity";
import { IBaseRepository } from "../interfaces/base.repository.interface";

export abstract class BaseRepository<T extends BaseEntity>
  implements IBaseRepository<T>
{
  constructor(protected readonly repository: Repository<T>) {}

  async getAll(relations = [], withDeleted = false): Promise<T[]> {
    return this.repository.find({
      withDeleted,
      relations,
    });
  }

  async getById(id: string, relations = [], withDeleted = false): Promise<T> {
    const findOptions: FindOneOptions<T> = {
      where: {
        id: id,
      } as FindOptionsWhere<T>,
      relations,
      withDeleted,
    };

    return await this.repository.findOne(findOptions);
  }
  async insert(data: T): Promise<T> {
    const entity = this.repository.create(data);
    return await this.repository.save(entity);
  }

  async update(id: string, data: Partial<any>): Promise<T> {
    await this.repository.update(id, data);
    return await this.getById(id, [], true);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected > 0 ? true : false;
  }
  async restore(id: string): Promise<boolean> {
    const result = await this.repository.restore(id);
    return result.affected > 0 ? true : false;
  }
  async archive(id: string): Promise<boolean> {
    const result = await this.repository.softDelete(id);
    return result.affected > 0 ? true : false;
  }
  async getOneBy(
    field: string,
    value: any,
    relations = [],
    withDeleted = false
  ): Promise<T> {
    const option = {};
    option[field] = value;
    return await this.repository.findOne({
      where: option,
      relations,
      withDeleted,
    });
  }
  async getOneByMultiple(
    conditions: FindOptionsWhere<T>,
    relations: string[] = [],
    withDeleted = false
  ): Promise<T | null> {
    return await this.repository.findOne({
      where: conditions,
      relations,
      withDeleted,
    });
  }
  async getAllBy(
    field: string,
    value: any,
    relations = [],
    withDeleted = false
  ): Promise<T[]> {
    const option = {};
    option[field] = value;
    return await this.repository.find({
      where: option,
      relations,
      withDeleted,
    });
  }
  async getAllByMultiple(
    conditions: FindOptionsWhere<T>,
    relations = [],
    withDeleted = false
  ): Promise<T[]> {
    return await this.repository.find({
      where: conditions,
      relations,
      withDeleted,
    });
  }
  async save(itemData: DeepPartial<T>): Promise<T> {
    return await this.repository.save(itemData);
  }
  async deleteAccount(
    id: string,
    entity1: ObjectType<T>,
    entity2: ObjectType<T>
  ): Promise<boolean> {
    try {
      const result = await this.repository.manager.transaction(
        async (entityManager: EntityManager) => {
          await entityManager.delete(entity1, { id });
          await entityManager.delete(entity2, { id });
        }
      );
      return true;
    } catch (error) {
      return false;
    }
  }
  async updateTables(
    id: string,
    entity1: ObjectType<any>,
    entity2: ObjectType<any>,
    updateData1: Partial<any>,
    updateData2: Partial<any>
  ): Promise<boolean> {
    try {
      await this.repository.manager.transaction(
        async (entityManager: EntityManager) => {
          // Update entity1 first
          const entity1Instance = await entityManager.findOne(entity1, {
            where: { id },
          });
          if (entity1Instance) {
            Object.assign(entity1Instance, updateData1);
            await entityManager.save(entity1Instance);
          }
          // Update entity2 next
          const entity2Instance = await entityManager.findOne(entity2, {
            where: { id },
          });
          if (entity2Instance) {
            Object.assign(entity2Instance, updateData2);
            await entityManager.save(entity2Instance);
          }
        }
      );
      return true;
    } catch (error) {
      // console.error('Error updating tables:', error);
      return false;
    }
  }
}
