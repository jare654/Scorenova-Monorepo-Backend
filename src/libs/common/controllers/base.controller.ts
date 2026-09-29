import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { BaseEntity } from "../entities/base.entity";
import { BaseService } from "../services/base.service";
import { AllowAnonymous } from "@account/auth/decorators/allow-anonymous.decorator";
import { ApiPaginatedResponse } from "@libs/response-format/api-paginated-response";
import { CollectionQuery } from "@libs/collection-query/collection-query";
import { BaseResponse } from "../responses/base.response";

@Controller()
export class BaseController<T extends BaseEntity> {
  constructor(private readonly baseService: BaseService<T>) {}

  @Get()
  @AllowAnonymous()
  async getAll(@Query() query?: CollectionQuery) {
    return this.baseService.getAll(query, BaseResponse);
  }
  // @Get("get-users")
  // async getUsers(@Query() query: CollectionQuery) {
  //   return this.baseService.getAll(query);
  // }
  @Get(":id")
  async getById(@Param("id") id: string) {
    return this.baseService.getById(id);
  }

  @Post()
  async create(@Body() createDto: Partial<T>) {
    return this.baseService.create(createDto);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() updateDto: Partial<T>) {
    return this.baseService.update(id, updateDto);
  }

  @Delete(":id")
  async delete(@Param("id") id: string) {
    return this.baseService.delete(id);
  }
}
