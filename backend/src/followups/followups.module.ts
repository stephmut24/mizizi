import { Module } from '@nestjs/common';
import { EldersModule } from '../elders/elders.module';
import { PlantsModule } from '../plants/plants.module';
import { FollowupsController } from './followups.controller';
import { FollowupsService } from './followups.service';
import { AssistantModule } from '../assistant/assistant.module';
import { PlantFollowupsController } from './plant-followups.controller';

@Module({
  imports: [PlantsModule, EldersModule, AssistantModule],
  controllers: [FollowupsController, PlantFollowupsController],
  providers: [FollowupsService],
  exports: [FollowupsService],
})
export class FollowupsModule {}
