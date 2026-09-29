import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TopicEntity } from "../../models/topics/topic.entity";
import { CreateTopicDto, UpdateTopicDto } from "./topic.commands";

@Injectable()
export class TopicCommands {
  constructor(
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
  ) {}

  async createTopic(dto: CreateTopicDto): Promise<TopicEntity> {
    const isFree = dto.isFree ?? (dto.accessType === "free");
    const accessType = dto.accessType ?? (isFree ? "free" : "paid");
    const durationMinutes = dto.durationMinutes ?? (dto as any).duration_minutes ?? null;
    const topic = this.topicRepo.create({
      ...dto,
      durationMinutes,
      isFree,
      accessType,
    });
    return this.topicRepo.save(topic);
  }

  async updateTopic(id: string, dto: UpdateTopicDto): Promise<TopicEntity> {
    const topic = await this.topicRepo.findOne({ where: { id } });
    if (!topic) {
      throw new NotFoundException(`Topic with ID ${id} not found`);
    }

    if (dto.isFree !== undefined && dto.accessType === undefined) {
      dto.accessType = dto.isFree ? "free" : "paid";
    } else if (dto.accessType !== undefined && dto.isFree === undefined) {
      dto.isFree = dto.accessType === "free";
    }

    const durationMinutes = dto.durationMinutes ?? (dto as any).duration_minutes;
    Object.assign(topic, dto);
    if (durationMinutes !== undefined) {
      topic.durationMinutes = durationMinutes;
    }
    return this.topicRepo.save(topic);
  }

  async deleteTopic(id: string): Promise<boolean> {
    const result = await this.topicRepo.delete(id);
    return result.affected > 0;
  }
}
