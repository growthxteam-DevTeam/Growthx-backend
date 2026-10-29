import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
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
    paymentUrl: string;
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
      paymentRequired: true,
    });

    const data = await this.applicationsRepository.save(application);

    // No review step: the applicant pays straight away, and the GS code is only emailed once
    // Bachs confirms it (see handlePaymentWebhook).
    let checkout: Awaited<ReturnType<BachsService['createCheckout']>>;
    try {
      checkout = await this.bachsService.createCheckout({
        applicationId: String(data._id),
        email: data.applicationPortal.email,
        name: data.applicationPortal.fullName,
      });
    } catch (error) {
      // Without a payment link the applicant is stuck, so undo the save and let them resubmit.
      this.logger.error(
        `Failed to create a Bachs checkout for ${String(data._id)}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.applicationsRepository.remove(data);
      throw new ServiceUnavailableException(
        'We could not start your payment. Please try again in a moment.',
      );
    }

    data.bachsCheckoutId = checkout.checkout_id;
    await this.applicationsRepository.save(data);

    // Not awaited: a mail outage must not fail an already-saved application.
    void this.mailService
      .sendPaymentRequest({
        to: data.applicationPortal.email,
        firstName: data.personalInfo.firstName,
        paymentUrl: checkout.checkout_url,
      })
      .catch((error: unknown) =>
        this.logger.error(
          `Failed to send payment-request email for ${String(data._id)}`,
          error instanceof Error ? error.stack : String(error),
        ),
      );

    return {
      status: 'Success',
      statusCode: 201,
      data,
      paymentUrl: checkout.checkout_url,
    };
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

    application.paidAt = new Date();
    await this.applicationsRepository.save(application);

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
