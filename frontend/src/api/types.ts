export interface Elder {
  id: number;
  display_name: string;
  languages: string[];
  consent_given: boolean;
  consent_note: string;
  created_at: string;
}

export interface Walk {
  id: number;
  elder_id: number;
  walk_date: string;
  place_label: string;
  duration_minutes: number | null;
  created_at: string;
  plant_count: number;
}

export interface Plant {
  id: number;
  elder_id: number;
  walk_id: number | null;
  local_name: string;
  other_names: string[];
  appearance: string[];
  habitat: string[];
  uses: string[];
  preparation: string[];
  warnings: string[];
  story: string;
  raw_notes: string;
  photo_path: string | null;
  visibility: 'private' | 'shareable';
  created_at: string;
  updated_at: string;
}

export type ElderInput = Omit<Elder, 'id' | 'created_at'>;
export type WalkInput = Omit<Walk, 'id' | 'created_at' | 'plant_count'>;
export type PlantInput = Omit<
  Plant,
  'id' | 'created_at' | 'updated_at' | 'photo_path'
>;
