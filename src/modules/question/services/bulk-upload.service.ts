import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import {
  QuestionDifficulty,
  QuestionEntity,
} from "../models/questions/question.entity";
import { SubjectEntity } from "../../subject/models/subjects/subject.entity";
import { TopicEntity } from "../../topic/models/topics/topic.entity";
import { StreamEntity } from "../../stream/models/streams/stream.entity";

// ─── Internal types ───────────────────────────────────────────────────────────

interface RawRow {
  [key: string]: string | undefined;
}

export interface BulkUploadResult {
  created: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class BulkUploadService {
  private readonly logger = new Logger(BulkUploadService.name);

  constructor(
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Public entry point ────────────────────────────────────────────────────

  async processFile(file: any): Promise<BulkUploadResult> {
    this.logger.log(`processFile called: name=${file?.originalname}, size=${file?.size}, hasBuffer=${!!file?.buffer}`);

    const ext = this.getExtension(file.originalname);
    this.logger.log(`File extension detected: "${ext}"`);

    let rows: RawRow[];
    if (ext === "csv") {
      const text = file.buffer.toString("utf8");
      this.logger.log(`CSV text length: ${text.length}, first 200 chars: ${text.slice(0, 200)}`);
      rows = this.parseCsv(text);
    } else if (ext === "xlsx" || ext === "xls") {
      rows = await this.parseExcel(file.buffer);
    } else {
      throw new BadRequestException(
        `Unsupported file type ".${ext}". Upload a .csv or .xlsx file.`,
      );
    }

    this.logger.log(`Parsed ${rows.length} data rows`);
    if (rows.length > 0) {
      this.logger.log(`First row keys: ${Object.keys(rows[0]).join(", ")}`);
      this.logger.log(`First row sample: ${JSON.stringify(rows[0]).slice(0, 300)}`);
    }

    if (rows.length === 0) {
      throw new BadRequestException("File contains no data rows.");
    }

    return this.processRows(rows);
  }

  // ─── Legacy JSON bulk insert (kept for backward compat) ───────────────────

  async bulkInsert(rows: Partial<QuestionEntity>[]): Promise<BulkUploadResult> {
    if (!rows.length) return { created: 0, skipped: 0, errors: [] };

    const CHUNK = 100;
    let created = 0;
    const errors: Array<{ row: number; reason: string }> = [];

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        try {
          const result = await manager
            .createQueryBuilder()
            .insert()
            .into(QuestionEntity)
            .values(chunk)
            .orIgnore()
            .execute();
          created += result.identifiers.length;
        } catch (err) {
          errors.push({ row: i, reason: (err as Error).message });
        }
      }
    });

    return { created, skipped: rows.length - created - errors.length, errors };
  }

  // ─── CSV parser ────────────────────────────────────────────────────────────

  private parseCsv(text: string): RawRow[] {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) return [];

    const headers = this.splitCsvLine(lines[0]).map((h) =>
      h.trim().toLowerCase().replace(/\s+/g, ""),
    );

    return lines.slice(1).map((line) => {
      const cols = this.splitCsvLine(line);
      const row: RawRow = {};
      headers.forEach((h, i) => {
        row[h] = cols[i]?.trim() ?? "";
      });
      return row;
    });
  }

  /** Handles quoted CSV fields that contain commas */
  private splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  // ─── Excel parser ──────────────────────────────────────────────────────────

  private async parseExcel(buffer: Buffer<ArrayBufferLike>): Promise<RawRow[]> {
    // Dynamic import — only load ExcelJS when actually needed
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    // ExcelJS typings expect its own Buffer; convert via ArrayBuffer to satisfy both
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );
    await workbook.xlsx.load(arrayBuffer as ArrayBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const rows: RawRow[] = [];
    let headers: string[] = [];

    sheet.eachRow((row, rowNumber) => {
      // ExcelJS row.values is 1-indexed; slice(1) to get 0-indexed array
      const values = (row.values as (string | null | undefined)[]).slice(1);

      if (rowNumber === 1) {
        headers = values.map((v) =>
          String(v ?? "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ""),
        );
        return;
      }

      const obj: RawRow = {};
      headers.forEach((h, i) => {
        obj[h] = String(values[i] ?? "").trim();
      });
      rows.push(obj);
    });

    return rows;
  }

  // ─── Subject name normalizer ───────────────────────────────────────────────
  // Maps common aliases to canonical DB subject names.

  private static readonly SUBJECT_ALIASES: Record<string, string> = {
    // Aptitude variants
    "aptitude test": "Aptitude",
    "aptitude":      "Aptitude",

    // Civics variants
    "civics & ethical education":   "Civics",
    "civics and ethical education": "Civics",
    "civic & ethical education":    "Civics",
    "civics":                       "Civics",

    // Mathematics variants
    "mathematics (natural sciences)": "Mathematics",
    "mathematics (social sciences)":  "Mathematics",
    "mathematics (natural science)":  "Mathematics",
    "mathematics (social science)":   "Mathematics",
    "mathematics":                    "Mathematics",

    // Economics variants
    "economics & management":   "Economics",

    // Explicitly skip — not part of the curriculum
    "agricultural economics":   "__skip__",
  };

  private normalizeSubjectName(raw: string): string {
    const trimmed = raw.trim();

    // Check explicit alias table first (case-insensitive)
    const aliasKey = trimmed.toLowerCase();
    const alias = BulkUploadService.SUBJECT_ALIASES[aliasKey];
    if (alias) return alias;

    // Fall back: strip parenthetical stream suffixes
    // e.g. "English (Natural Science)" → "English"
    const withoutStream = trimmed.replace(/\s*\(.*?\)\s*$/, "").trim();
    return withoutStream;
  }

  // ─── Row processing ────────────────────────────────────────────────────────

  private async processRows(rawRows: RawRow[]): Promise<BulkUploadResult> {
    // Build lookup caches — one query each, no N+1
    // subjectCache keys:
    //   `name.lower:streamId` → id   (stream-specific, e.g. Mathematics per stream)
    //   `name.lower:null`     → id   (common subjects, e.g. English, Civics, Aptitude)
    //   `name.lower`          → id   (fallback — stream-specific beats null-stream)
    const subjectCache = new Map<string, string>();
    const topicCache = new Map<string, string>();    // `${subjectId}:${name.lower}` → id

    const [allSubjects, allStreams] = await Promise.all([
      this.subjectRepo.find({ select: ["id", "name", "streamId"] }),
      this.streamRepo.find({ select: ["id", "name"] }),
    ]);
    this.logger.log(`Loaded ${allSubjects.length} subjects from DB: ${allSubjects.map(s => s.name).join(", ")}`);

    // Build a stream name → id map for fast lookup (supports "natural", "natural science", etc.)
    const streamNameToId = new Map<string, string>();
    for (const st of allStreams) {
      streamNameToId.set(st.name.toLowerCase(), st.id);
      // Short alias: "natural science" → also register "natural"
      const firstWord = st.name.toLowerCase().split(" ")[0];
      if (!streamNameToId.has(firstWord)) streamNameToId.set(firstWord, st.id);
    }

    // Populate both the precise key (name:streamId) and the fallback key (name).
    // For the fallback key: prefer stream-specific rows over null-stream rows.
    const sorted = [...allSubjects].sort((a, b) => {
      if (!a.streamId && b.streamId) return -1; // null first → gets overwritten
      if (a.streamId && !b.streamId) return 1;
      return 0;
    });
    for (const s of sorted) {
      // Precise key: always unique per (name, streamId) pair
      subjectCache.set(`${s.name.toLowerCase()}:${s.streamId ?? "null"}`, s.id);
      // Fallback key: last write wins (stream-specific beats null-stream)
      subjectCache.set(s.name.toLowerCase(), s.id);
    }

    const allTopics = await this.topicRepo.find({
      select: ["id", "name", "subjectId"],
    });
    this.logger.log(`Loaded ${allTopics.length} topics from DB`);
    for (const t of allTopics) {
      topicCache.set(`${t.subjectId}:${t.name.toLowerCase()}`, t.id);
    }

    // Duplicate detection against existing DB rows
    const existingHashes = await this.buildExistingHashes();

    const toInsert: Partial<QuestionEntity>[] = [];
    const errors: Array<{ row: number; reason: string }> = [];
    let skipped = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2; // account for 1-index + header row

      // ── Required: text ──
      const text = raw["text"]?.trim() || raw["question"]?.trim();
      if (!text) {
        errors.push({ row: rowNum, reason: "Missing required field: text" });
        continue;
      }

      // ── Required: correctAnswer ──
      const correctAnswer =
        raw["correctanswer"]?.trim() || raw["answer"]?.trim();
      if (!correctAnswer) {
        errors.push({
          row: rowNum,
          reason: "Missing required field: correctAnswer",
        });
        continue;
      }

      // ── Required: subjectName ──
      const subjectNameRaw =
        raw["subjectname"]?.trim() || raw["subject"]?.trim();
      if (!subjectNameRaw) {
        errors.push({
          row: rowNum,
          reason: "Missing required field: subjectName",
        });
        continue;
      }

      // Normalize aliases like "English (Natural Science)" → "English"
      const subjectName = this.normalizeSubjectName(subjectNameRaw);

      // "__skip__" means this subject is intentionally excluded from the curriculum
      if (subjectName === "__skip__") {
        skipped++;
        continue;
      }

      this.logger.log(`Row ${rowNum}: raw subject="${subjectNameRaw}" → normalized="${subjectName}"`);

      // Attempt precise lookup using optional stream column in the CSV
      const streamRaw = (raw["stream"]?.trim() || raw["streamname"]?.trim() || "").toLowerCase();
      let subjectId: string | undefined;
      if (streamRaw) {
        const resolvedStreamId = streamNameToId.get(streamRaw);
        if (resolvedStreamId) {
          subjectId = subjectCache.get(`${subjectName.toLowerCase()}:${resolvedStreamId}`);
        }
      }
      // Fall back to simple name lookup (stream-specific beats null-stream due to sort above)
      if (!subjectId) {
        subjectId = subjectCache.get(subjectName.toLowerCase());
      }
      if (!subjectId) {
        // Check if any subject with this name already exists under any stream
        // before auto-creating — avoids duplicate null-stream subjects
        const existingAny = await this.subjectRepo.findOne({
          where: { name: subjectName },
        });
        if (existingAny) {
          subjectCache.set(subjectName.toLowerCase(), existingAny.id);
          this.logger.log(`Row ${rowNum}: Subject "${subjectName}" found by name fallback id=${existingAny.id}`);
        } else {
          // Truly new subject — auto-create with null stream
          this.logger.log(`Row ${rowNum}: Subject "${subjectName}" not found — auto-creating`);
          try {
            const newSubject = this.subjectRepo.create({
              name: subjectName,
              streamId: null,
              gradeId: null,
            });
            const saved = await this.subjectRepo.save(newSubject);
            subjectCache.set(subjectName.toLowerCase(), saved.id);
            this.logger.log(`Row ${rowNum}: Subject created: "${subjectName}" id=${saved.id}`);
          } catch (subjectErr) {
            const retry = await this.subjectRepo.findOne({ where: { name: subjectName } });
            if (retry) {
              subjectCache.set(subjectName.toLowerCase(), retry.id);
            } else {
              this.logger.error(`Row ${rowNum}: Failed to create subject "${subjectName}": ${(subjectErr as Error).message}`);
              errors.push({ row: rowNum, reason: `Subject not found: "${subjectName}"` });
              continue;
            }
          }
        }
      }

      // Re-read from cache (may have just been auto-created above)
      // Use the already-resolved precise ID if available, otherwise fall back to name key
      const resolvedSubjectId = subjectId ?? subjectCache.get(subjectName.toLowerCase())!;

      // ── Optional: topicName — auto-create if missing ──
      const topicName = raw["topicname"]?.trim() || raw["topic"]?.trim();
      let topicId: string | undefined;
      if (topicName) {
        const cacheKey = `${resolvedSubjectId}:${topicName.toLowerCase()}`;
        topicId = topicCache.get(cacheKey);
        if (!topicId) {
          // Auto-create the topic so the upload doesn't fail
          this.logger.log(`Row ${rowNum}: Auto-creating topic "${topicName}" under subject "${subjectName}"`);
          try {
            const newTopic = this.topicRepo.create({
              name: topicName,
              subjectId: resolvedSubjectId,
              description: null,
            });
            const saved = await this.topicRepo.save(newTopic);
            topicId = saved.id;
            topicCache.set(cacheKey, topicId);
            this.logger.log(`Row ${rowNum}: Topic created with id=${topicId}`);
          } catch (topicErr) {
            this.logger.error(`Row ${rowNum}: Failed to create topic "${topicName}": ${(topicErr as Error).message}`);
            errors.push({ row: rowNum, reason: `Failed to create topic "${topicName}": ${(topicErr as Error).message}` });
            continue;
          }
        }
      }

      // ── Duplicate detection / subject remapping ───────────────────────────
      // If a question with this text+answer already exists but under a different
      // subject (e.g. uploaded under Social Science Math, now re-uploading for
      // Natural Science Math), UPDATE the subject rather than skip.
      const hash = this.hashRow(text, correctAnswer);
      if (existingHashes.has(hash)) {
        // Check if the existing question is under a different subject
        if (resolvedSubjectId) {
          const existingQ = await this.questionRepo.findOne({
            where: { text, correctAnswer },
            select: ["id", "subjectId"],
          });
          if (existingQ && existingQ.subjectId !== resolvedSubjectId) {
            // Remap to the correct subject
            await this.questionRepo.update(existingQ.id, { subjectId: resolvedSubjectId });
            this.logger.log(`Row ${rowNum}: Remapped question to subject ${resolvedSubjectId}`);
          }
        }
        skipped++;
        continue;
      }
      existingHashes.add(hash); // prevent intra-upload duplicates too

      // ── Parse options (pipe-separated) ──
      const optionsRaw = raw["options"]?.trim();
      const options = optionsRaw
        ? optionsRaw
            .split("|")
            .map((o) => o.trim())
            .filter(Boolean)
        : [];

      // ── Parse difficulty ──
      const difficultyRaw = raw["difficulty"]?.trim().toLowerCase();
      const difficulty =
        difficultyRaw === "easy"
          ? QuestionDifficulty.Easy
          : difficultyRaw === "hard"
            ? QuestionDifficulty.Hard
            : QuestionDifficulty.Medium;

      toInsert.push({
        text,
        options,
        correctAnswer,
        difficulty,
        subjectId: resolvedSubjectId,
        topicId,
        explanation: raw["explanation"]?.trim() || null,
      });
    }

    // ── Batch insert in chunks of 100 inside a single transaction ──
    let created = 0;
    const CHUNK = 100;

    this.logger.log(`Attempting to insert ${toInsert.length} questions (skipped=${skipped}, errors=${errors.length})`);

    if (toInsert.length > 0) {
      try {
        await this.dataSource.transaction(async (manager) => {
          for (let i = 0; i < toInsert.length; i += CHUNK) {
            const chunk = toInsert.slice(i, i + CHUNK);
            this.logger.log(`Inserting chunk ${i}–${i + chunk.length}`);
            const result = await manager
              .createQueryBuilder()
              .insert()
              .into(QuestionEntity)
              .values(chunk)
              .execute();
            created += result.identifiers.length;
            this.logger.log(`Chunk inserted: ${result.identifiers.length} rows`);
          }
        });
      } catch (dbErr) {
        this.logger.error(`DB insert failed: ${(dbErr as Error).message}`, (dbErr as Error).stack);
        throw dbErr;
      }
    }

    this.logger.log(
      `Bulk upload: created=${created}, skipped=${skipped}, errors=${errors.length}`,
    );

    return { created, skipped, errors };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async buildExistingHashes(): Promise<Set<string>> {
    const existing = await this.questionRepo.find({
      select: ["text", "correctAnswer"],
    });
    const set = new Set<string>();
    for (const q of existing) {
      set.add(this.hashRow(q.text, q.correctAnswer));
    }
    return set;
  }

  private hashRow(
    text: string,
    correctAnswer: string,
  ): string {
    const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
    return `${normalized}|${correctAnswer.trim().toLowerCase()}`;
  }

  private getExtension(filename: string): string {
    return filename.split(".").pop()?.toLowerCase() ?? "";
  }
}
