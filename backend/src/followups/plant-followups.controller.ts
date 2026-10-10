import { Body, Controller, HttpCode, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServerResponse } from 'node:http';
import { IdDto } from '../common/id.dto';
import { SaveQuestionsDto } from './followups.dto';
import { FollowupsService } from './followups.service';

@ApiTags('followups')
@Controller('plants/:id/followups')
export class PlantFollowupsController {
  constructor(private readonly followups: FollowupsService) {}

  @Post('suggest')
  @HttpCode(200)
  async suggest(
    @Param() { id }: IdDto,
    @Res({ passthrough: true }) response: ServerResponse,
  ) {
    const controller = new AbortController();
    const disconnect = () => {
      if (!response.writableEnded) controller.abort();
    };
    response.on('close', disconnect);
    try {
      return await this.followups.suggest(id, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    } finally {
      response.off('close', disconnect);
    }
  }

  @Post()
  save(@Param() { id }: IdDto, @Body() dto: SaveQuestionsDto) {
    return this.followups.saveChosen(id, dto.questions);
  }
}
