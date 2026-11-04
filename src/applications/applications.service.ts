import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { ObjectId } from 'mongodb';
import { Repository } from 'typeorm';

import { BachsService } from 'src/utility/bachs/bachs.service';
import { CloudinaryService } from 'src/utility/cloudinary/cloudinary.service';
import { ApplicationStatus } from 'src/utility/common/application-status.enum';
import { generateGsCode } from 'src/utility/common/generate-gs-code';
import { MailService } from 'src/utility/mail/mail.service';

import { CreateApplicationDto } from './dto/create-application.dto';
import { CreatePasswordDto } from './dto/create-password.dto';
import { ApplicationEntity } from './entities/application.entity';

const PASSWORD_SALT_ROUNDS = 10;

const PASSPORT_PHOTO_CLOUDINARY_FOLDER = 'growth-x/passport-photos';

// Webhook bodies are an envelope `{ id, type, created_at, organization_id, data }`; the checkout
// id is `data.checkout_id` (or `data.id` when the event's resource is the checkout itself).
const extractCheckoutId = (body: unknown): string | undefined => {
  if (typeof body !== 'object' || body === null) return undefined;
  const data = (body as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return undefined;

  const { checkout_id: checkoutId, id } = data as Record<string, unknown>;
  if (typeof checkoutId === 'string') return checkoutId;
  if (typeof id === 'string' && id.startsWith('chk_')) return id;
  return undefined;
};

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepository: Repository<ApplicationEntity>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailService: MailService,
    private readonly bachsService: BachsService,
  ) {}

  async create(
    dto: CreateApplicationDto,
    passportPhoto?: Express.Multer.File,
  ): Promise<{
    status: string;
    statusCode: number;
    data: ApplicationEntity;
  }> {
    const passportPhotoUrl = passportPhoto
      ? (
          await this.cloudinaryService.uploadImage(
            passportPhoto,
            PASSPORT_PHOTO_CLOUDINARY_FOLDER,
          )
        ).secure_url
      : undefined;

    // The wizard submits one flat payload, but the record is stored grouped
    // by the screen each field came from — see entities/application-groups.entity.ts.
    const application = this.applicationsRepository.create({
      applicationPortal: {
        fullName: dto.fullName,
        email: dto.email,
        program: dto.program,
        cohort: dto.cohort,
      },
      personalInfo: {
        title: dto.title,
        surname: dto.surname,
        firstName: dto.firstName,
        businessName: dto.businessName,
        dateOfBirth: dto.dateOfBirth,
        gender: dto.gender,
      },
      businessBasics: {
        businessDescription: dto.businessDescription,
        operatingDuration: dto.operatingDuration,
        averageRevenue: dto.averageRevenue,
        fullTimeCommitment: dto.fullTimeCommitment,
      },
      whoYouAre: {
        challengeAndSkillGap: dto.challengeAndSkillGap,
        cohortMotivation: dto.cohortMotivation,
      },
      accessibilitySupport: {
        hasAccessibilityNeeds: dto.hasAccessibilityNeeds,
        accessibilityNeed: dto.accessibilityNeed,
        // Only meaningful alongside a "yes"; drop it if a client sends notes with "no".
        accessibilityNotes:
          dto.hasAccessibilityNeeds === 'yes'
            ? dto.accessibilityNotes
            : undefined,
      },
      submit: {
        passportPhotoUrl,
      },
      gsCode: generateGsCode(),
      status: ApplicationStatus.PENDING,
    });

    const data = await this.applicationsRepository.save(application);

    // No payment and no GS code yet: an admin reviews the application and sends the invite
    // (see AdminApplicationsService.invite). Not awaited: a mail outage must not fail an
    // already-saved application.
    void this.mailService
      .sendApplicationReceived({
        to: data.applicationPortal.email,
        firstName: data.personalInfo.firstName,
      })
      .catch((error: unknown) =>
        this.logger.error(
          `Failed to send application-received email for ${String(data._id)}`,
          error instanceof Error ? error.stack : String(error),
        ),
      );

    return { status: 'Success', statusCode: 201, data };
  }

  // Bachs calls this when a checkout changes. The body only tells us which checkout to look at:
  // payment is confirmed by asking Bachs for the session with our API key, so a forged request
  // can't mark anyone as paid. Throwing (e.g. Bachs unreachable) makes Bachs retry the delivery.
  async handlePaymentWebhook(body: unknown): Promise<void> {
    const checkoutId = extractCheckoutId(body);
    if (!checkoutId) return;

    const application = await this.applicationsRepository.findOneBy({
      bachsCheckoutId: checkoutId,
    });
    if (!application || application.paidAt) return;

    const session = await this.bachsService.getCheckoutSession(checkoutId);
    if (!this.bachsService.isPaid(session)) return;

    await this.markPaid(application);
  }

  // Logged-in applicants: has this account paid? An unpaid account with a checkout in flight is
  // re-checked with Bachs here, so the dashboard unlocks even if the webhook is late or can't
  // reach us (local dev). A Bachs outage just reads as "not paid yet".
  async getPaymentStatus(applicationId: string): Promise<{
    status: string;
    statusCode: number;
    data: { hasPaid: boolean };
  }> {
    const application = await this.findApplication(applicationId);

    if (!application.paidAt) {
      await this.syncPaymentWithBachs(application).catch((error: unknown) =>
        this.logger.error(
          `Failed to re-check payment for ${String(application._id)}`,
          error instanceof Error ? error.stack : String(error),
        ),
      );
    }

    return {
      status: 'Success',
      statusCode: 200,
      data: { hasPaid: Boolean(application.paidAt) },
    };
  }

  // Starts (or restarts) the program-fee checkout for a logged-in applicant. The latest checkout id
  // replaces any earlier one, which is the one the webhook matches on.
  async createPaymentCheckout(applicationId: string): Promise<{
    status: string;
    statusCode: number;
    paymentUrl: string;
  }> {
    const application = await this.findApplication(applicationId);

    // An earlier checkout may have been paid after the dashboard last looked; don't charge twice.
    await this.syncPaymentWithBachs(application).catch(() => undefined);
    if (application.paidAt) {
      throw new ConflictException('Payment has already been made');
    }

    let session: Awaited<ReturnType<BachsService['createCheckout']>>;
    try {
      session = await this.bachsService.createCheckout({
        applicationId: String(application._id),
        email: application.applicationPortal.email,
        name: application.applicationPortal.fullName,
      });
    } catch (error) {
      this.logger.error(
        `Failed to create Bachs checkout for ${String(application._id)}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Payment could not be started. Please try again.',
      );
    }

    application.bachsCheckoutId = session.checkout_id;
    await this.applicationsRepository.save(application);

    return {
      status: 'Success',
      statusCode: 200,
      paymentUrl: session.checkout_url,
    };
  }

  private async findApplication(id: string): Promise<ApplicationEntity> {
    const application = ObjectId.isValid(id)
      ? await this.applicationsRepository.findOneBy({ _id: new ObjectId(id) })
      : null;
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  // Asks Bachs about the application's latest checkout and records the payment if it went through.
  private async syncPaymentWithBachs(
    application: ApplicationEntity,
  ): Promise<void> {
    if (application.paidAt || !application.bachsCheckoutId) return;

    const session = await this.bachsService.getCheckoutSession(
      application.bachsCheckoutId,
    );
    if (this.bachsService.isPaid(session)) await this.markPaid(application);
  }

  private async markPaid(application: ApplicationEntity): Promise<void> {
    application.paidAt = new Date();
    await this.applicationsRepository.save(application);

    // Accounts that already have a password (payment taken after login) don't need a GS code.
    if (application.passwordHash) return;

    void this.mailService
      .sendPaymentConfirmed({
        to: application.applicationPortal.email,
        firstName: application.personalInfo.firstName,
        gsCode: application.gsCode,
      })
      .catch((error: unknown) =>
        this.logger.error(
          `Failed to send payment-confirmed email for ${String(application._id)}`,
          error instanceof Error ? error.stack : String(error),
        ),
      );
  }

  async createPassword(
    dto: CreatePasswordDto,
  ): Promise<{ status: string; statusCode: number; message: string }> {
    const application = await this.applicationsRepository.findOneBy({
      gsCode: dto.gsCode,
    });

    if (!application) {
      throw new BadRequestException('Invalid GS code');
    }
    if (application.passwordHash) {
      throw new ConflictException('This GS code has already been used');
    }
    // An earlier invite's code stops working once the application is rejected.
    if (application.status === ApplicationStatus.REJECTED) {
      throw new ForbiddenException('This application was not accepted');
    }
    if (application.paymentRequired && !application.paidAt) {
      throw new ForbiddenException(
        'Payment is required before you can create your password',
      );
    }

    application.passwordHash = await bcrypt.hash(
      dto.password,
      PASSWORD_SALT_ROUNDS,
    );
    await this.applicationsRepository.save(application);

    return {
      status: 'Success',
      statusCode: 200,
      message: 'Password created successfully',
    };
  }
}
