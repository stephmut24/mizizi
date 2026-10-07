import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EldersService } from '../elders/elders.service';
import { WalksService } from '../walks/walks.service';
import { readStringList, requiredText } from '../common/validation';
import {
  CreatePlantDto,
  PlantQueryDto,
  UpdatePlantDto,
  Visibility,
  visibilities,
} from './plants.dto';

interface PlantRow {
  id: number;
  elder_id: number;
  walk_id: number | null;
  local_name: string;
  other_names: string;
  appearance: string;
  habitat: string;
  uses: string;
  preparation: string;
  warnings: string;
  story: string;
  raw_notes: string;
  photo_path: string | null;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

function toPlant(row: PlantRow) {
  return {
    ...row,
    other_names: readStringList(row.other_names),
    appearance: readStringList(row.appearance),
    habitat: readStringList(row.habitat),
    uses: readStringList(row.uses),
    preparation: readStringList(row.preparation),
    warnings: readStringList(row.warnings),
  };
}

// Escape LIKE metacharacters so a search for '%' or '_' is literal.
function searchPattern(text: string) {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}

@Injectable()
export class PlantsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly elders: EldersService,
    private readonly walks: WalksService,
  ) {}

  private validate(dto: CreatePlantDto) {
    this.elders.requireConsent(dto.elder_id);
    if (dto.walk_id != null) this.walks.requireElder(dto.walk_id, dto.elder_id);
    requiredText(dto.local_name, 'local_name');
    if (!visibilities.includes(dto.visibility ?? 'private')) {
      throw new BadRequestException('visibility must be private or shareable.');
    }
  }

  private values(dto: CreatePlantDto) {
    return [
      dto.elder_id,
      dto.walk_id ?? null,
      requiredText(dto.local_name, 'local_name'),
      JSON.stringify(dto.other_names ?? []),
      JSON.stringify(dto.appearance ?? []),
      JSON.stringify(dto.habitat ?? []),
      JSON.stringify(dto.uses ?? []),
      JSON.stringify(dto.preparation ?? []),
      JSON.stringify(dto.warnings ?? []),
      dto.story ?? '',
      dto.raw_notes ?? '',
      dto.photo_path ?? null,
      dto.visibility ?? 'private',
    ];
  }

  create(dto: CreatePlantDto) {
    this.validate(dto);
    const result = this.db.run(
      `
      INSERT INTO plants (elder_id, walk_id, local_name, other_names, appearance, habitat,
        uses, preparation, warnings, story, raw_notes, photo_path, visibility)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      ...this.values(dto),
    );
    return this.get(Number(result.lastInsertRowid));
  }

  list(query: PlantQueryDto = {}) {
    const conditions: string[] = [];
    const parameters: (string | number)[] = [];
    if (query.elderId !== undefined) {
      conditions.push('elder_id = ?');
      parameters.push(query.elderId);
    }
    if (query.visibility !== undefined) {
      conditions.push('visibility = ?');
      parameters.push(query.visibility);
    }
    if (query.search?.trim()) {
      conditions.push(`(local_name LIKE ? ESCAPE '\\' OR EXISTS (
        SELECT 1 FROM json_each(plants.other_names) WHERE value LIKE ? ESCAPE '\\'
      ))`);
      const pattern = searchPattern(query.search.trim());
      parameters.push(pattern, pattern);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.db
      .all<PlantRow>(
        `SELECT * FROM plants ${where} ORDER BY id DESC`,
        ...parameters,
      )
      .map(toPlant);
  }

  get(id: number) {
    const row = this.db.get<PlantRow>('SELECT * FROM plants WHERE id = ?', id);
    if (!row) throw new NotFoundException(`Plant ${id} was not found.`);
    return toPlant(row);
  }

  update(id: number, dto: UpdatePlantDto) {
    const current = this.get(id);
    this.elders.requireConsent(current.elder_id);
    const updated = { ...current, ...dto };
    this.validate(updated);
    this.db.run(
      `
      UPDATE plants SET elder_id = ?, walk_id = ?, local_name = ?, other_names = ?,
        appearance = ?, habitat = ?, uses = ?, preparation = ?, warnings = ?,
        story = ?, raw_notes = ?, photo_path = ?, visibility = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?
    `,
      ...this.values(updated),
      id,
    );
    return this.get(id);
  }

  delete(id: number) {
    this.get(id);
    this.db.run('DELETE FROM plants WHERE id = ?', id);
  }
}
