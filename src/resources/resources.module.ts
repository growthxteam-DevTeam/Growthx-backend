import { Module } from '@nestjs/common';

import { AuthModule } from 'src/auth/auth.module';

import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';

// AuthModule exports JwtModule, which JwtAuthGuard on the controller needs.
@Module({
  imports: [AuthModule],
  controllers: [ResourcesController],
  providers: [ResourcesService],
})
export class ResourcesModule {}
