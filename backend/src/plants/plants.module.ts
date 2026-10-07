import { Module } from '@nestjs/common';
import { EldersModule } from '../elders/elders.module';
import { WalksModule } from '../walks/walks.module';
import { PlantsController } from './plants.controller';
import { PlantsService } from './plants.service';

@Module({
  imports: [EldersModule, WalksModule],
  controllers: [PlantsController],
  providers: [PlantsService],
  exports: [PlantsService],
})
export class PlantsModule {}
