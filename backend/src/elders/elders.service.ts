import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { readStringList, requiredText } from '../common/validation';
import { CreateElderDto, UpdateElderDto } from './elders.dto';

interface ElderRow {
  id: number;
  display_name: string;
  languages: string;
  consent_given: number;
  consent_note: string;
  created_at: string;
}

function toElder(row: ElderRow) {
  return {
    ...row,
    languages: readStringList(row.languages),
    consent_given: row.consent_given === 1,
  };
}

@Injectable()
export class EldersService {
  constructor(private readonly db: DatabaseService) {}

  create(dto: CreateElderDto) {
    const result = this.db.run(
      'INSERT INTO elders (display_name, languages, consent_given, consent_note) VALUES (?, ?, ?, ?)',
      requiredText(dto.display_name, 'display_name'),
      JSON.stringify(dto.languages ?? []),
      dto.consent_given ? 1 : 0,
      dto.consent_note ?? '',
    );
    return this.get(Number(result.lastInsertRowid));
  }

  list() {
    return this.db
      .all<ElderRow>('SELECT * FROM elders ORDER BY id DESC')
      .map(toElder);
  }

  get(id: number) {
    const row = this.db.get<ElderRow>('SELECT * FROM elders WHERE id = ?', id);
    if (!row) throw new NotFoundException(`Elder ${id} was not found.`);
    return toElder(row);
  }

  update(id: number, dto: UpdateElderDto) {
    const elder = { ...this.get(id), ...dto };
    this.db.run(
      'UPDATE elders SET display_name = ?, languages = ?, consent_given = ?, consent_note = ? WHERE id = ?',
      requiredText(elder.display_name, 'display_name'),
      JSON.stringify(elder.languages),
      elder.consent_given ? 1 : 0,
      elder.consent_note,
      id,
    );
    return this.get(id);
  }

  requireConsent(id: number) {
    const elder = this.get(id);
    if (!elder.consent_given) {
      throw new BadRequestException(
        `Consent must be recorded for elder ${id} before saving a plant.`,
      );
    }
    return elder;
  }
}
