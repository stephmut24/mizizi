import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IdDto } from '../common/id.dto';
import { CreateElderDto, UpdateElderDto } from './elders.dto';
import { EldersService } from './elders.service';

@ApiTags('elders')
@Controller('elders')
export class EldersController {
  constructor(private readonly elders: EldersService) {}

  @Post()
  create(@Body() dto: CreateElderDto) {
    return this.elders.create(dto);
  }

  @Get()
  list() {
    return this.elders.list();
  }

  @Get(':id')
  get(@Param() { id }: IdDto) {
    return this.elders.get(id);
  }

  @Patch(':id')
  update(@Param() { id }: IdDto, @Body() dto: UpdateElderDto) {
    return this.elders.update(id, dto);
  }
}
