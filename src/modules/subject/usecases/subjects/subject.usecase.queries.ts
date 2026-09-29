import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { SubjectEntity } from "../../models/subjects/subject.entity";
import { StreamEntity } from "../../../stream/models/streams/stream.entity";
import { TopicEntity } from "../../../topic/models/topics/topic.entity";

export interface SubjectDto {
  id: string;
  name: string;
  streamId: string | null;
  description: string | null;
  isFree: boolean;
  accessType: string;
  topicCount: number;
}

@Injectable()
export class SubjectQueries {
  constructor(
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
  ) {}

  async getSubjects(
    streamId?: string,
    streamName?: string,
    gradeId?: string,
  ): Promise<SubjectDto[]> {
    let subjects: SubjectEntity[];

    const rawStream = streamId?.trim() || streamName?.trim();
    if (rawStream) {
      const resolvedStreamId = await this.resolveStreamId(rawStream);
      if (!resolvedStreamId) return [];
      subjects = await this.findByStreamId(resolvedStreamId);
    } else if (gradeId?.trim()) {
      subjects = await this.subjectRepo.find({
        where: { gradeId },
        select: ["id", "name", "streamId", "description", "isFree", "accessType"],
        order: { name: "ASC" },
      });
    } else {
      subjects = await this.subjectRepo.find({
        select: ["id", "name", "streamId", "description", "isFree", "accessType"],
        order: { name: "ASC" },
      });
    }

    if (subjects.length === 0) return [];

    // Count topics per subject in a single query
    const subjectIds = subjects.map((s) => s.id);
    const topicCounts: { subjectId: string; count: string }[] = await this.topicRepo
      .createQueryBuilder("t")
      .select("t.subjectId", "subjectId")
      .addSelect("COUNT(t.id)", "count")
      .where("t.subjectId IN (:...ids)", { ids: subjectIds })
      .groupBy("t.subjectId")
      .getRawMany();

    const countMap = new Map(topicCounts.map((r) => [r.subjectId, Number(r.count)]));

    return subjects.map((s) => ({
      id:          s.id,
      name:        s.name,
      streamId:    s.streamId,
      description: s.description,
      isFree:      s.isFree ?? false,
      accessType:  s.accessType ?? (s.isFree ? "free" : "paid"),
      topicCount:  countMap.get(s.id) ?? 0,
    }));
  }

  private async findByStreamId(streamId: string): Promise<SubjectEntity[]> {
    // Return subjects belonging to the given stream AND subjects that are
    // common to all streams (stream_id IS NULL — e.g. English, Civics, Aptitude).
    return this.subjectRepo
      .createQueryBuilder("s")
      .select(["s.id", "s.name", "s.streamId", "s.description", "s.isFree", "s.accessType"])
      .where("s.streamId = :streamId OR s.streamId IS NULL", { streamId })
      .orderBy("s.name", "ASC")
      .getMany();
  }

  private async resolveStreamId(stream: string): Promise<string | null> {
    if (!stream?.trim()) return null;
    const val = stream.trim();

    // 1. Check known legacy UUIDs
    const legacyMap: Record<string, string> = {
      "5d24102f-a070-4c18-b612-fa070447f158": "Natural Science",
      "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22": "Natural Science",
      "c891ef18-1d77-4861-9bbc-186b4bc96c23": "Social Science",
      "cleebc99-9c0b-4ef8-bb6d-6bb9bd380a33": "Social Science",
    };
    if (legacyMap[val.toLowerCase()]) {
      const entity = await this.streamRepo.findOne({
        where: { name: ILike(legacyMap[val.toLowerCase()]) },
      });
      if (entity) return entity.id;
    }

    // 2. Check if val is already a valid stream UUID in the DB
    try {
      const streamById = await this.streamRepo.findOne({ where: { id: val } });
      if (streamById) return streamById.id;
    } catch (_) {}

    // 3. Normalize name and find by name
    const normalized = this.normalizeStreamName(val);
    const streamEntity = await this.streamRepo.findOne({
      where: { name: ILike(normalized) },
    });
    return streamEntity?.id ?? null;
  }

  private normalizeStreamName(value: string): string {
    const cleaned = value.trim().toLowerCase();
    if (cleaned === "social" || cleaned === "social science") {
      return "Social Science";
    }
    if (cleaned === "natural" || cleaned === "natural science") {
      return "Natural Science";
    }
    return value;
  }
}
