import { Module } from '@nestjs/common';

import { BachsService } from './bachs.service';

@Module({
  providers: [BachsService],
  exports: [BachsService],
})
export class BachsModule {}
