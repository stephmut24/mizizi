import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { OptionalField } from '../common/validation';

export type Visibility = 'private' | 'shareable';
export const visibilities = ['private', 'shareable'] as const;

export class CreatePlantDto {
  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  elder_id!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  walk_id?: number | null;

  @ApiProperty({ example: 'Demo plant' })
  @IsString()
  @Matches(/\S/, { message: 'local_name must not be empty.' })
  local_name!: string;

  @ApiPropertyOptional({ type: [String], default: [] })
  @OptionalField()
  @IsArray()
  @IsString({ each: true })
  other_names?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @OptionalField()
  @IsArray()
  @IsString({ each: true })
  appearance?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @OptionalField()
  @IsArray()
  @IsString({ each: true })
  habitat?: string[];

  @ApiPropertyOptional({
    type: [String],
    default: [],
    description: 'Traditional uses told by the elder. Not medical advice.',
  })
  @OptionalField()
  @IsArray()
  @IsString({ each: true })
  uses?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @OptionalField()
  @IsArray()
  @IsString({ each: true })
  preparation?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @OptionalField()
  @IsArray()
  @IsString({ each: true })
  warnings?: string[];

  @ApiPropertyOptional({ default: '' })
  @OptionalField()
  @IsString()
  story?: string;

  @ApiPropertyOptional({
    default: '',
    description: 'Original notes; preserved verbatim.',
  })
  @OptionalField()
  @IsString()
  raw_notes?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Metadata only; no photo upload or serving in this milestone.',
  })
  @IsOptional()
  @IsString()
  photo_path?: string | null;

  @ApiPropertyOptional({ enum: visibilities, default: 'private' })
  @OptionalField()
  @IsIn(visibilities)
  visibility?: Visibility;
}

export class UpdatePlantDto extends PartialType(CreatePlantDto, {
  skipNullProperties: false,
}) {}

export class PlantQueryDto {
  @ApiPropertyOptional({ minimum: 1, type: Number })
  @OptionalField()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  elderId?: number;

  @ApiPropertyOptional({ enum: visibilities })
  @OptionalField()
  @IsIn(visibilities)
  visibility?: Visibility;

  @ApiPropertyOptional({
    description:
      'Literal substring of local_name or other_names; ASCII case-insensitive.',
  })
  @OptionalField()
  @IsString()
  search?: string;
}
