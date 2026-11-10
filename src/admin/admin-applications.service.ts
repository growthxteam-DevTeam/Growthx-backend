import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectId } from 'mongodb';
import { MongoRepository } from 'typeorm';

import { ApplicationEntity } from 'src/applications/entities/application.entity';
import { ApplicationStatus } from 'src/utility/common/application-status.enum';
import { MailService } from 'src/utility/mail/mail.service';

import {
  DEFAULT_APPLICATIONS_PAGE_SIZE,
  ListApplicationsQueryDto,
} from './dto/list-applications-query.dto';

// What the review table gets: everything the applicant submitted plus where they are in the flow.
// Built field by field so the GS code and password hash can never ride along.
const toAdminView = (application: ApplicationEntity) => ({
  id: String(application._id),
  applicationPortal: application.applicationPortal,
  personalInfo: application.personalInfo,
  businessBasics: application.businessBasics,
  whoYouAre: application.whoYouAre,
  accessibilitySupport: application.accessibilitySupport,
  // Missing on records saved without a passport photo, so always send an object.
  submit: application.submit ?? {},
  status: application.status,
  createdAt: application.createdAt,
  invitedAt: application.invitedAt ?? null,
  hasAccount: Boolean(application.passwordHash),
});

@Injectable()
export class AdminApplicationsService {
  private readonly logger = new Logger(AdminApplicationsService.name);

  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepository: MongoRepository<ApplicationEntity>,
    private readonly mailService: MailService,
  ) {}

  // Newest first, one page at a time. `_id` breaks ties so applications created in the same
  // millisecond can't swap between pages.
  async list({
    page = 1,
    limit = DEFAULT_APPLICATIONS_PAGE_SIZE,
  }: ListApplicationsQueryDto) {
    const [applications, total] =
      await this.applicationsRepository.findAndCount({
        order: { createdAt: 'DESC', _id: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    return {
      status: 'Success',
      statusCode: 200,
      data: applications.map(toAdminView),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  // Emails the applicant their GS code. Safe to repeat (it doubles as "resend"), until they have
  // used the code to create a password.
  async invite(id: string) {
    const application = await this.findApplication(id);

    if (application.passwordHash) {
      throw new ConflictException(
        'This applicant has already created an account',
      );
    }

    // Awaited, unlike the other emails: the admin needs to know when the invite did not go out.
    try {
      await this.mailService.sendInvite({
        to: application.applicationPortal.email,
        firstName: application.personalInfo.firstName,
        gsCode: application.gsCode,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send invite email for ${String(application._id)}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'The invite email could not be sent. Please try again.',
      );
    }

    application.invitedAt = new Date();
    application.status = ApplicationStatus.ACCEPTED;
    await this.applicationsRepository.save(application);

    return {
      status: 'Success',
      statusCode: 200,
      message: 'Invite sent',
      data: toAdminView(application),
    };
  }

  // Emails the applicant that they were not accepted and marks the application rejected. Refused
  // once they have an account, and for an application that is already rejected (no second email).
  async reject(id: string) {
    const application = await this.findApplication(id);

    if (application.passwordHash) {
      throw new ConflictException(
        'This applicant has already created an account',
      );
    }
    if (application.status === ApplicationStatus.REJECTED) {
      throw new ConflictException('This application has already been rejected');
    }

    // Awaited, like the invite: the admin needs to know when the email did not go out, and the
    // application stays un-rejected so they can retry.
    try {
      await this.mailService.sendRejection({
        to: application.applicationPortal.email,
        firstName: application.personalInfo.firstName,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send rejection email for ${String(application._id)}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'The rejection email could not be sent. Please try again.',
      );
    }

    application.status = ApplicationStatus.REJECTED;
    await this.applicationsRepository.save(application);

    return {
      status: 'Success',
      statusCode: 200,
      message: 'Applicant rejected',
      data: toAdminView(application),
    };
  }

  private async findApplication(id: string): Promise<ApplicationEntity> {
    const application = ObjectId.isValid(id)
      ? await this.applicationsRepository.findOneBy({ _id: new ObjectId(id) })
      : null;
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }
}
