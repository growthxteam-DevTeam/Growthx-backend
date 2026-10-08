import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { ApplicationsService } from './applications.service';
import { passportPhotoMulterOptions } from './config/passport-photo.multer-options';
import { CreateApplicationDto } from './dto/create-application.dto';
import { CreatePasswordDto } from './dto/create-password.dto';

// Needed so @Exclude() fields on ApplicationEntity (gsCode) are stripped from responses.
@UseInterceptors(ClassSerializerInterceptor)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  // Public — this is the onboarding wizard's final submit step; there is no
  // auth in front of it.
  @Post()
  @UseInterceptors(FileInterceptor('passportPhoto', passportPhotoMulterOptions))
  create(
    @Body() createApplicationDto: CreateApplicationDto,
    @UploadedFile() passportPhoto?: Express.Multer.File,
  ) {
    return this.applicationsService.create(createApplicationDto, passportPhoto);
  }

  // Public — the GS code emailed after submission is the only credential.
  @Post('create-password')
  @HttpCode(200)
  createPassword(@Body() createPasswordDto: CreatePasswordDto) {
    return this.applicationsService.createPassword(createPasswordDto);
  }
}
