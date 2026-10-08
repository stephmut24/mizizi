import { z } from 'zod';

export const listTopics = [
  'otherNames',
  'appearance',
  'habitat',
  'uses',
  'preparation',
  'warnings',
  'story',
] as const;
export const topics = ['localName', ...listTopics] as const;
export type Topic = (typeof topics)[number];

export const evidencedSchema = z.strictObject({
  text: z.string().min(1).max(1000),
  quote: z.string().min(1).max(4000),
});
const items = z.array(evidencedSchema).max(12);
export const organizedCardSchema = z.strictObject({
  localName: evidencedSchema.nullable(),
  otherNames: items,
  appearance: items,
  habitat: items,
  uses: items,
  preparation: items,
  warnings: items,
  story: items,
  missing: z.array(z.enum(topics)).max(topics.length),
});

export type Evidenced = z.infer<typeof evidencedSchema>;
export type OrganizedCard = z.infer<typeof organizedCardSchema>;
export const organizedCardJsonSchema = z.toJSONSchema(organizedCardSchema, {
  target: 'draft-7',
});
