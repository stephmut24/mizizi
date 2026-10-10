import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuestionsService } from '../assistant/questions.service';
import { isSafeQuestion } from '../assistant/question-guard';
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
    private readonly questions: QuestionsService,
  ) {}

  private requireConsent(plantId: number) {
    this.elders.requireConsent(this.plants.get(plantId).elder_id);
  }

  create(dto: CreateFollowupDto) {
    this.requireConsent(dto.plant_id);
    this.validateQuestion(dto.question);
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
    if (dto.question !== undefined) this.validateQuestion(dto.question);
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

  private validateQuestion(question: string) {
    if (!isSafeQuestion(question))
      throw new BadRequestException(
        'Questions must end with ?, be at most 140 characters, and contain no numbers or treatment advice.',
      );
  }

  async suggest(plantId: number, signal?: AbortSignal) {
    this.requireConsent(plantId);
    const result = await this.questions.suggestQuestions(
      this.plants.get(plantId),
      signal,
    );
    // Consent may have changed during a slow model response.
    this.requireConsent(plantId);
    return result;
  }

  saveChosen(plantId: number, questions: string[]) {
    this.requireConsent(plantId);
    if (questions.length < 1 || questions.length > 4) {
      throw new BadRequestException('Choose between one and four questions.');
    }
    questions.forEach((question) => this.validateQuestion(question));
    return this.db.transaction(() =>
      questions.map((question) => {
        const text = question.trim();
        const existing = this.db.get<FollowupRow>(
          'SELECT * FROM followups WHERE plant_id = ? AND question = ?',
          plantId,
          text,
        );
        return existing
          ? toFollowup(existing)
          : this.create({ plant_id: plantId, question: text });
      }),
    );
  }
}
