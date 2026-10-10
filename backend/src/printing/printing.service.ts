import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { readStringList } from '../common/validation';

interface PrintRow {
  id: number;
  local_name: string;
  other_names: string;
  appearance: string;
  habitat: string;
  uses: string;
  preparation: string;
  warnings: string;
  story: string;
  walk_date: string | null;
}

const cardColumns = `p.id, p.local_name, p.other_names, p.appearance,
  p.habitat, p.uses, p.preparation, p.warnings, p.story, w.walk_date`;

function card(row: PrintRow) {
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

@Injectable()
export class PrintingService {
  constructor(private readonly db: DatabaseService) {}

  private elder(id: number) {
    const row = this.db.get<{
      id: number;
      display_name: string;
      consent_given: number;
    }>('SELECT id, display_name, consent_given FROM elders WHERE id = ?', id);
    if (!row) throw new NotFoundException(`Person ${id} was not found.`);
    if (!row.consent_given)
      throw new ForbiddenException(
        'Consent must be recorded before printing this person’s notebook.',
      );
    return { id: row.id, display_name: row.display_name };
  }

  plant(id: number) {
    const record = this.db.get<{ elder_id: number; visibility: string }>(
      'SELECT elder_id, visibility FROM plants WHERE id = ?',
      id,
    );
    if (!record) throw new NotFoundException(`Plant ${id} was not found.`);
    if (record.visibility !== 'shareable')
      throw new ForbiddenException(
        'This plant is private. Only shareable plants can be printed.',
      );
    const elder = this.elder(record.elder_id);
    const row = this.db.get<PrintRow>(
      `SELECT ${cardColumns} FROM plants p
      LEFT JOIN walks w ON w.id = p.walk_id WHERE p.id = ? AND p.visibility = 'shareable'`,
      id,
    );
    if (!row) throw new NotFoundException(`Plant ${id} was not found.`);
    return { elder, plant: card(row) };
  }

  booklet(elderId: number) {
    const elder = this.elder(elderId);
    const plants = this.db
      .all<PrintRow>(
        `SELECT ${cardColumns} FROM plants p
      LEFT JOIN walks w ON w.id = p.walk_id
      WHERE p.elder_id = ? AND p.visibility = 'shareable' ORDER BY p.id`,
        elderId,
      )
      .map(card);
    const skippedPrivateCount =
      this.db.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM plants WHERE elder_id = ? AND visibility = 'private'",
        elderId,
      )?.count ?? 0;
    return { elder, plants, skippedPrivateCount };
  }

  nextWalk(elderId: number) {
    const elder = this.elder(elderId);
    // Private folios expose only an identifier and questions, never a plant name or notes.
    const rows = this.db.all<{
      plant_id: number;
      label: string;
      id: number;
      question: string;
    }>(
      `SELECT p.id AS plant_id,
       CASE WHEN p.visibility = 'shareable' THEN p.local_name ELSE 'Folio #' || p.id END AS label,
       f.id, f.question FROM followups f JOIN plants p ON p.id = f.plant_id
       WHERE p.elder_id = ? AND f.answered = 0 ORDER BY p.id, f.id`,
      elderId,
    );
    const groups: {
      plant_id: number;
      label: string;
      questions: { id: number; question: string }[];
    }[] = [];
    for (const row of rows) {
      let group = groups.at(-1);
      if (!group || group.plant_id !== row.plant_id) {
        group = { plant_id: row.plant_id, label: row.label, questions: [] };
        groups.push(group);
      }
      group.questions.push({ id: row.id, question: row.question });
    }
    return { elder, groups };
  }
}
