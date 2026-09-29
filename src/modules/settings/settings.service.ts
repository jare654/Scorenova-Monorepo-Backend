import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SettingsEntity } from "./models/settings.entity";

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SettingsEntity)
    private readonly settingsRepo: Repository<SettingsEntity>,
  ) {}

  /**
   * Get a settings section by name.
   * Always trims the key, and auto-heals corrupted rows (e.g. "premium\n").
   * If a dirty variant exists but the clean key does not, it migrates the data
   * into the clean key and deletes the dirty row.
   */
  async getSection(section: string): Promise<SettingsEntity> {
    const key = section.trim();

    // Try exact match first
    const existing = await this.settingsRepo.findOne({ where: { section: key } });
    if (existing) {
      return existing;
    }

    // Fallback: find any row whose trimmed section matches (e.g. "premium\n")
    const allRows = await this.settingsRepo
      .createQueryBuilder("s")
      .where("TRIM(s.section) = :key", { key })
      .getMany();

    if (allRows.length > 0) {
      // Pick the row with the most data, migrate it to the clean key
      const best = allRows.reduce((a, b) =>
        Object.keys(b.data ?? {}).length > Object.keys(a.data ?? {}).length ? b : a
      );

      // Delete all dirty rows first to avoid unique constraint conflict
      for (const row of allRows) {
        try {
          await this.settingsRepo.delete({ id: row.id });
        } catch {
          // ignore
        }
      }

      // Now upsert under the clean key
      const healed = this.settingsRepo.create({ section: key, data: best.data ?? {} });
      return this.settingsRepo.save(healed);
    }

    // No row at all — create fresh
    const created = this.settingsRepo.create({ section: key, data: {} });
    return this.settingsRepo.save(created);
  }

  async updateSection(section: string, data: Record<string, any>) {
    const key = section.trim();
    // getSection handles healing + upsert; then we just update
    const existing = await this.settingsRepo.findOne({ where: { section: key } });
    if (existing) {
      existing.data = data ?? {};
      return this.settingsRepo.save(existing);
    }
    return this.settingsRepo.save(
      this.settingsRepo.create({ section: key, data: data ?? {} }),
    );
  }
}
