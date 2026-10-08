import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class OrganizeDto {
  @ApiProperty({
    description: 'Original notes; default limit 4000 characters.',
    example: 'We call it Kijani. Its leaves are green.',
  })
  @IsString()
  @Matches(/\S/u, { message: 'Please write some notes first.' })
  rawNotes!: string;
}
