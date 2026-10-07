import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EldersService } from '../elders/elders.service';
import { requiredText } from '../common/validation';
import { CreateWalkDto } from './walks.dto';

interface WalkRow {
  id: number;
  elder_id: number;
  walk_date: string;
  place_label: string;
  duration_minutes: number | null;
  created_at: string;
}

@Injectable()
export class WalksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly elders: EldersService,
  ) {}

  create(dto: CreateWalkDto) {
    this.elders.get(dto.elder_id);
    const result = this.db.run(
      'INSERT INTO walks (elder_id, walk_date, place_label, duration_minutes) VALUES (?, ?, ?, ?)',
      dto.elder_id,
      dto.walk_date,
      requiredText(dto.place_label, 'place_label'),
      dto.duration_minutes ?? null,
    );
    return this.get(Number(result.lastInsertRowid));
  }

  list() {
    return this.db.all<WalkRow & { plant_count: number }>(`
      SELECT walks.*, COUNT(plants.id) AS plant_count
      FROM walks LEFT JOIN plants ON plants.walk_id = walks.id
      GROUP BY walks.id ORDER BY walks.walk_date DESC, walks.id DESC
    `);
  }

  get(id: number) {
    const row = this.db.get<WalkRow>('SELECT * FROM walks WHERE id = ?', id);
    if (!row) throw new NotFoundException(`Walk ${id} was not found.`);
    return row;
  }

  requireElder(id: number, elderId: number) {
    const walk = this.get(id);
    if (walk.elder_id !== elderId) {
      throw new BadRequestException(
        'The walk and plant must belong to the same elder.',
      );
    }
  }
}
