import { BadRequestException } from '@nestjs/common';
import { ValidateIf } from 'class-validator';
import { z } from 'zod';

// Unlike IsOptional, this skips omitted values but still rejects null.
export function OptionalField(): PropertyDecorator {
  return ValidateIf((_: unknown, value: unknown) => value !== undefined);
}

export function requiredText(value: string, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${field} must not be empty.`);
  }
  return value.trim();
}

export function readStringList(value: string): string[] {
  return z.array(z.string()).parse(JSON.parse(value));
}
