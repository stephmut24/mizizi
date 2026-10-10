import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IdDto } from '../common/id.dto';
import { PrintingService } from './printing.service';

@ApiTags('printing')
@Controller('print')
export class PrintingController {
  constructor(private readonly printing: PrintingService) {}

  @Get('plants/:id')
  @Header('Cache-Control', 'no-store')
  plant(@Param() { id }: IdDto) {
    return this.printing.plant(id);
  }

  @Get('booklet/:id')
  @Header('Cache-Control', 'no-store')
  booklet(@Param() { id }: IdDto) {
    return this.printing.booklet(id);
  }

  @Get('nextwalk/:id')
  @Header('Cache-Control', 'no-store')
  nextWalk(@Param() { id }: IdDto) {
    return this.printing.nextWalk(id);
  }
}
