import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StreamEntity } from "../../models/streams/stream.entity";
import { CreateStreamDto, UpdateStreamDto } from "./stream.commands";

@Injectable()
export class StreamCommands {
  constructor(
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
  ) {}

  async createStream(dto: CreateStreamDto): Promise<StreamEntity> {
    const existing = await this.streamRepo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Stream "${dto.name}" already exists`);
    }
    const stream = this.streamRepo.create(dto);
    return this.streamRepo.save(stream);
  }

  async updateStream(id: string, dto: UpdateStreamDto): Promise<StreamEntity> {
    const stream = await this.streamRepo.findOne({ where: { id } });
    if (!stream) {
      throw new NotFoundException(`Stream with ID ${id} not found`);
    }
    Object.assign(stream, dto);
    return this.streamRepo.save(stream);
  }

  async deleteStream(id: string): Promise<boolean> {
    const result = await this.streamRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
