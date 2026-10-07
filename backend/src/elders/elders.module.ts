import { Module } from '@nestjs/common';
import { EldersController } from './elders.controller';
import { EldersService } from './elders.service';

@Module({
  controllers: [EldersController],
  providers: [EldersService],
  exports: [EldersService],
})
export class EldersModule {}
