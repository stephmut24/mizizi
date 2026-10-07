import { Module } from '@nestjs/common';
import { EldersModule } from '../elders/elders.module';
import { WalksController } from './walks.controller';
import { WalksService } from './walks.service';

@Module({
  imports: [EldersModule],
  controllers: [WalksController],
  providers: [WalksService],
  exports: [WalksService],
})
export class WalksModule {}
