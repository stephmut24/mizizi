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
import {
  CreateFollowupDto,
  FollowupQueryDto,
  UpdateFollowupDto,
} from './followups.dto';
import { FollowupsService } from './followups.service';

@ApiTags('followups')
@Controller('followups')
export class FollowupsController {
  constructor(private readonly followups: FollowupsService) {}

  @Post()
  create(@Body() dto: CreateFollowupDto) {
    return this.followups.create(dto);
  }

  @Get()
  list(@Query() query: FollowupQueryDto) {
    return this.followups.list(query);
  }

  @Get(':id')
  get(@Param() { id }: IdDto) {
    return this.followups.get(id);
  }

  @Patch(':id')
  update(@Param() { id }: IdDto, @Body() dto: UpdateFollowupDto) {
    return this.followups.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param() { id }: IdDto) {
    this.followups.delete(id);
  }
}
