import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IdDto } from '../common/id.dto';
import { CreateWalkDto } from './walks.dto';
import { WalksService } from './walks.service';

@ApiTags('walks')
@Controller('walks')
export class WalksController {
  constructor(private readonly walks: WalksService) {}

  @Post()
  create(@Body() dto: CreateWalkDto) {
    return this.walks.create(dto);
  }

  @Get()
  list() {
    return this.walks.list();
  }

  @Get(':id')
  get(@Param() { id }: IdDto) {
    return this.walks.get(id);
  }
}
