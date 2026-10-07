import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PlantsService } from '../plants/plants.service';
import { EldersService } from '../elders/elders.service';
import { requiredText } from '../common/validation';
import {
  CreateFollowupDto,
  FollowupQueryDto,
  UpdateFollowupDto,
} from './followups.dto';

interface FollowupRow {
  id: number;
  plant_id: number;
  question: string;
  answered: number;
  created_at: string;
}

function toFollowup(row: FollowupRow) {
  return { ...row, answered: row.answered === 1 };
}

@Injectable()
export class FollowupsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly plants: PlantsService,
    private readonly elders: EldersService,
  ) {}

  private requireConsent(plantId: number) {
    this.elders.requireConsent(this.plants.get(plantId).elder_id);
  }

  create(dto: CreateFollowupDto) {
    this.requireConsent(dto.plant_id);
    const result = this.db.run(
      'INSERT INTO followups (plant_id, question, answered) VALUES (?, ?, ?)',
      dto.plant_id,
      requiredText(dto.question, 'question'),
      dto.answered ? 1 : 0,
    );
    return this.get(Number(result.lastInsertRowid));
  }

  list(query: FollowupQueryDto = {}) {
    const rows =
      query.plantId === undefined
        ? this.db.all<FollowupRow>('SELECT * FROM followups ORDER BY id DESC')
        : this.db.all<FollowupRow>(
            'SELECT * FROM followups WHERE plant_id = ? ORDER BY id DESC',
            query.plantId,
          );
    return rows.map(toFollowup);
  }

  get(id: number) {
    const row = this.db.get<FollowupRow>(
      'SELECT * FROM followups WHERE id = ?',
      id,
    );
    if (!row) throw new NotFoundException(`Follow-up ${id} was not found.`);
    return toFollowup(row);
  }

  update(id: number, dto: UpdateFollowupDto) {
    const followup = { ...this.get(id), ...dto };
    this.requireConsent(followup.plant_id);
    this.db.run(
      'UPDATE followups SET question = ?, answered = ? WHERE id = ?',
      requiredText(followup.question, 'question'),
      followup.answered ? 1 : 0,
      id,
    );
    return this.get(id);
  }

  delete(id: number) {
    this.get(id);
    this.db.run('DELETE FROM followups WHERE id = ?', id);
  }
}
