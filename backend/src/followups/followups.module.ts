import { Module } from '@nestjs/common';
import { EldersModule } from '../elders/elders.module';
import { PlantsModule } from '../plants/plants.module';
import { FollowupsController } from './followups.controller';
import { FollowupsService } from './followups.service';

@Module({
  imports: [PlantsModule, EldersModule],
  controllers: [FollowupsController],
  providers: [FollowupsService],
  exports: [FollowupsService],
})
export class FollowupsModule {}
