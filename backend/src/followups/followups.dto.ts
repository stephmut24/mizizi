import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { OptionalField } from '../common/validation';

export class CreateFollowupDto {
  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  plant_id!: number;

  @ApiProperty({ example: 'What would you like to tell me on our next walk?' })
  @IsString()
  @Matches(/\S/, { message: 'question must not be empty.' })
  question!: string;

  @ApiPropertyOptional({ default: false })
  @OptionalField()
  @IsBoolean()
  answered?: boolean;
}

export class UpdateFollowupDto extends PartialType(
  PickType(CreateFollowupDto, ['question', 'answered'] as const),
  { skipNullProperties: false },
) {}

export class FollowupQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @OptionalField()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  plantId?: number;
}
