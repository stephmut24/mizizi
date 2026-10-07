import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsString, Matches } from 'class-validator';
import { OptionalField } from '../common/validation';

export class CreateElderDto {
  @ApiProperty({ example: 'Demo elder' })
  @IsString()
  @Matches(/\S/, { message: 'display_name must not be empty.' })
  display_name!: string;

  @ApiPropertyOptional({ type: [String], default: [] })
  @OptionalField()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({ default: false })
  @OptionalField()
  @IsBoolean()
  consent_given?: boolean;

  @ApiPropertyOptional({ default: '' })
  @OptionalField()
  @IsString()
  consent_note?: string;
}

export class UpdateElderDto extends PartialType(CreateElderDto, {
  skipNullProperties: false,
}) {}
