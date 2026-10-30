import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

import { GetResourcesQueryDto } from './dto/get-resources-query.dto';
import { ResourcesService } from './resources.service';

// Needs a logged-in applicant (Authorization: Bearer <jwt>), like the rest of the dashboard API.
@UseGuards(JwtAuthGuard)
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  async list(@Query() query: GetResourcesQueryDto) {
    const data = await this.resourcesService.search(query);
    return { status: 'Success', statusCode: 200, data };
  }
}
