import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LLM_CLIENT } from './llm-client';
import { OllamaClient } from './ollama.client';
import { OrganizerService } from './organizer.service';
import { AssistantController } from './assistant.controller';
import { QuestionsService } from './questions.service';

@Module({
  imports: [ConfigModule],
  controllers: [AssistantController],
  providers: [
    { provide: LLM_CLIENT, useClass: OllamaClient },
    OrganizerService,
    QuestionsService,
  ],
  exports: [OrganizerService, QuestionsService],
})
export class AssistantModule {}
