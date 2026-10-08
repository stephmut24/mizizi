import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LLM_CLIENT } from './llm-client';
import { OllamaClient } from './ollama.client';
import { OrganizerService } from './organizer.service';

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: LLM_CLIENT, useClass: OllamaClient },
    OrganizerService,
  ],
  exports: [OrganizerService],
})
export class AssistantModule {}
