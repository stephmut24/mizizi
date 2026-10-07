import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateWalkDto {
  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  elder_id!: number;

  @ApiProperty({
    example: '2026-10-07',
    description: 'Calendar date: YYYY-MM-DD.',
  })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  walk_date!: string;

  @ApiProperty({ example: 'Family garden', maxLength: 200 })
  @IsString()
  @Matches(/\S/, { message: 'place_label must not be empty.' })
  @MaxLength(200)
  place_label!: string;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  duration_minutes?: number | null;
}
