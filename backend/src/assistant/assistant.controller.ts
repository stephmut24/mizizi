import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ServerResponse } from 'node:http';
import { AssistantBadOutputError, AssistantUnavailableError } from './errors';
import { OrganizeDto } from './organize.dto';
import { OrganizerService } from './organizer.service';

@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly organizer: OrganizerService) {}

  @Post('organize')
  @HttpCode(200)
  @ApiOperation({ summary: 'Propose an evidenced card. Saves nothing.' })
  @ApiResponse({
    status: 200,
    description:
      'Card, kept/removed counts, missing topics and rejected diagnostics.',
  })
  @ApiResponse({ status: 400, description: 'Invalid or oversized notes.' })
  @ApiResponse({
    status: 422,
    description: 'Unusable model output after one retry.',
  })
  @ApiResponse({
    status: 503,
    description: 'Local AI unavailable; manual writing still works.',
  })
  async organize(
    @Body() dto: OrganizeDto,
    @Res({ passthrough: true }) response: ServerResponse,
  ) {
    const controller = new AbortController();
    // Response close detects a disconnected browser even after its body was read.
    const disconnect = () => {
      if (!response.writableEnded) controller.abort();
    };
    response.once('close', disconnect);
    try {
      return await this.organizer.organizeNotes(
        dto.rawNotes,
        controller.signal,
      );
    } catch (error) {
      // The socket is already closed: no error response or server-error logging.
      if (controller.signal.aborted) return;
      if (error instanceof AssistantUnavailableError)
        throw new ServiceUnavailableException(
          'The local AI is not available right now. Check that Ollama is running and the model is installed, or try shorter notes. Writing the card by hand still works.',
        );
      if (error instanceof AssistantBadOutputError)
        throw new UnprocessableEntityException(
          'The model gave an unusable answer. Try again or write the card by hand.',
        );
      throw error;
    } finally {
      response.off('close', disconnect);
    }
  }
}
