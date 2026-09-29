import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StreamEntity } from "../../models/streams/stream.entity";

@Injectable()
export class StreamQueries {
  constructor(
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
  ) {}

  async getStreams(): Promise<{ id: string; name: string; description: string | null }[]> {
    return this.streamRepo.find({
      select: ["id", "name", "description"],
      order: { name: "ASC" },
    });
  }

  async getStreamById(id: string): Promise<StreamEntity | null> {
    return this.streamRepo.findOne({ where: { id } });
  }
}
