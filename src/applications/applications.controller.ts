import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from 'src/auth/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.type';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

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
  // Public — called by Bachs. Always answers 200 once handled; the service re-checks the payment
  // with Bachs itself, so the body is never trusted.
  @Post('payment-webhook')
  @HttpCode(200)
  async paymentWebhook(@Body() body: unknown) {
    await this.applicationsService.handlePaymentWebhook(body);
    return { received: true };
  }

  // JWT — has the logged-in applicant paid? The dashboard blocks itself with a payment modal until
  // this says so.
  @UseGuards(JwtAuthGuard)
  @Get('me/payment')
  getPaymentStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.applicationsService.getPaymentStatus(user.id);
  }

  // JWT — creates a Bachs checkout for the logged-in applicant and returns its hosted URL.
  @UseGuards(JwtAuthGuard)
  @Post('me/payment/checkout')
  @HttpCode(200)
  createPaymentCheckout(@CurrentUser() user: AuthenticatedUser) {
    return this.applicationsService.createPaymentCheckout(user.id);
  }

  @Post('create-password')
  @HttpCode(200)
  createPassword(@Body() createPasswordDto: CreatePasswordDto) {
    return this.applicationsService.createPassword(createPasswordDto);
  }
}
