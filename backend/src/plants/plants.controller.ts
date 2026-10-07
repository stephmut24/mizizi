import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IdDto } from '../common/id.dto';
import { CreatePlantDto, PlantQueryDto, UpdatePlantDto } from './plants.dto';
import { PlantsService } from './plants.service';

@ApiTags('plants')
@Controller('plants')
export class PlantsController {
  constructor(private readonly plants: PlantsService) {}

  @Post()
  create(@Body() dto: CreatePlantDto) {
    return this.plants.create(dto);
  }

  @Get()
  list(@Query() query: PlantQueryDto) {
    return this.plants.list(query);
  }

  @Get(':id')
  get(@Param() { id }: IdDto) {
    return this.plants.get(id);
  }

  @Patch(':id')
  update(@Param() { id }: IdDto, @Body() dto: UpdatePlantDto) {
    return this.plants.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param() { id }: IdDto) {
    this.plants.delete(id);
  }
}
