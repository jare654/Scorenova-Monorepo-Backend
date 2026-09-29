import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TopicEntity } from "../../models/topics/topic.entity";

@Injectable()
export class TopicQueries {
  constructor(
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
  ) {}

  async getTopicsBySubject(subjectId: string): Promise<{ id: string; name: string; description: string | null; durationMinutes: number | null; isFree: boolean; accessType: string }[]> {
    if (!subjectId?.trim()) return [];
    const topics = await this.topicRepo.find({
      where: { subjectId },
      select: ["id", "name", "description", "durationMinutes", "isFree", "accessType"],
      order: { name: "ASC" },
    });
    return topics.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      durationMinutes: t.durationMinutes ?? null,
      isFree: t.isFree ?? false,
      accessType: t.accessType ?? (t.isFree ? "free" : "paid"),
    }));
  }
}
